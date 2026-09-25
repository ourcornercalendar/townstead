import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { generateCashFlowPdf } from "@/lib/pdf/cash-flow";

export async function GET(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const editionId = searchParams.get("editionId");
  const yearStr = searchParams.get("year");
  const paymentYearStr = searchParams.get("paymentYear");

  if (!yearStr) {
    return NextResponse.json(
      { error: "Missing year" },
      { status: 400 }
    );
  }

  const year = parseInt(yearStr, 10);
  const paymentYear = paymentYearStr ? parseInt(paymentYearStr, 10) : undefined;
  const convex = await getConvexClient();

  const reportPromise = convex.query(api.billing.queries.getCashFlowReport, {
    orgId,
    ...(editionId
      ? { calendarEditionId: editionId as Id<"calendarEditions"> }
      : {}),
    year,
    ...(paymentYear !== undefined ? { paymentYear } : {}),
  });

  const editionPromise = editionId
    ? convex.query(api.calendarEditions.queries.getById, {
        id: editionId as Id<"calendarEditions">,
      })
    : Promise.resolve(null);

  const [report, edition] = await Promise.all([reportPromise, editionPromise]);

  const editionName = edition?.name ?? "All Editions";

  const pdfBytes = await generateCashFlowPdf({
    editionName,
    year,
    paymentYear,
    columns: report.columns,
    rows: report.rows,
    summary: report.summary,
  });

  const editionSlug = editionName.replace(/\s+/g, "-").toLowerCase();
  const yearSuffix = paymentYear && paymentYear !== year
    ? `${year}-py${paymentYear}`
    : `${year}`;
  const filename = `cash-flow-${editionSlug}-${yearSuffix}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
