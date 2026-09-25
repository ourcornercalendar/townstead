import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { generateCalendarPdf } from "@/lib/pdf/calendar-grid";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { orgId: clerkOrgId } = await auth();

  const { searchParams } = request.nextUrl;
  const yearStr = searchParams.get("year");
  if (!yearStr) {
    return NextResponse.json({ error: "Missing year" }, { status: 400 });
  }
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const convex = await getConvexClient();

  // Whoever is asking is either an administrator, who carries the
  // organisation on their sign-in, or a calendar helper, who deliberately does
  // not belong to one and whose organisation is recorded in the grant instead.
  // This is the file the printed calendar is set from, so the person keeping
  // the calendar needs to be able to hand it to the designer without going
  // through Joyce every time.
  let orgId = clerkOrgId;
  if (!orgId) {
    const workspace = await convex.query(
      api.teamInvites.queries.myWorkspace,
      {}
    );
    orgId = workspace?.orgId ?? null;
  }
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const editionIdParam = searchParams.get("calendarEditionId");

  let calendarEditionId: Id<"calendarEditions"> | null = null;
  let editionLabel = "Community Calendar";
  let editionSlug = "";

  if (editionIdParam) {
    const edition = await convex.query(api.calendarEditions.queries.getById, {
      id: editionIdParam as Id<"calendarEditions">,
    });
    if (!edition || edition.orgId !== orgId || edition.isDeleted) {
      return NextResponse.json(
        { error: "Calendar edition not found" },
        { status: 404 }
      );
    }
    calendarEditionId = edition._id;
    editionLabel = edition.name;
    editionSlug =
      (edition.code || edition.name)
        .toLowerCase()
        .replace(/[^\w-]+/g, "-")
        .replace(/^-|-$/g, "") || "edition";
  }

  const events = await convex.query(api.events.queries.list, { orgId });

  const pdfBuffer = await generateCalendarPdf({
    year,
    events,
    editionLabel,
    calendarEditionId,
  });

  const filename = editionSlug
    ? `calendar-${year}-${editionSlug}.pdf`
    : `calendar-${year}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
