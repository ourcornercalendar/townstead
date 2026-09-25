import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { buildEventExportMonthGroups } from "@/lib/events-export";
import { generateEventsExportPdf } from "@/lib/pdf/events-export";

export async function GET(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const editionIdParam = searchParams.get("calendarEditionId");

  let calendarEditionId: Id<"calendarEditions"> | null = null;
  let editionLabel: string | undefined;
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
  const months = buildEventExportMonthGroups(events, year, calendarEditionId);

  const pdfBytes = await generateEventsExportPdf({
    year,
    editionLabel,
    months,
  });

  const filename = editionSlug
    ? `events-${year}-${editionSlug}.pdf`
    : `events-calendar-${year}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
