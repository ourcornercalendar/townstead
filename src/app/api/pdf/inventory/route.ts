import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  generateInventoryPdf,
  type InventoryPdfSlot,
} from "@/lib/pdf/inventory";

export async function GET(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? "", 10);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const editionIdsParam = searchParams.get("editionIds") ?? "";
  const calendarEditionIds = editionIdsParam
    .split(",")
    .filter(Boolean) as Id<"calendarEditions">[];
  if (calendarEditionIds.length === 0) {
    return NextResponse.json(
      { error: "editionIds is required" },
      { status: 400 }
    );
  }

  const adIdsRaw = searchParams.get("adIds");
  const advertisementIds =
    adIdsRaw === null
      ? undefined
      : (adIdsRaw.split(",").filter(Boolean) as Id<"advertisements">[]);

  const convex = await getConvexClient();
  const data = await convex.query(api.dashboard.queries.getPrintInventoryData, {
    orgId,
    year,
    calendarEditionIds,
    advertisementIds,
  });

  const editions = data.editions.map((e) => ({
    editionName: e.editionName,
    slots: e.slots.map(
      (s): InventoryPdfSlot => ({
        month: s.month,
        slotNumber: s.slotNumber,
        company: s.company,
        contactName: s.contactName,
        advertisementName: s.advertisementName,
        advertisementId: s.advertisementId.toString(),
        isDayType: s.isDayType,
      })
    ),
  }));

  const pdfBytes = await generateInventoryPdf({ year, editions });

  const filename = `inventory-${year}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
