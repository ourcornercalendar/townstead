import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { generatePurchaseStatementPdf } from "@/lib/pdf/purchase-statement";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const convex = await getConvexClient();

  const [data, settings] = await Promise.all([
    convex.query(api.billing.queries.getStatementDataByPurchase, {
      purchaseId: id as Id<"purchases">,
      orgId,
      now: Date.now(),
    }),
    convex.query(api.settings.queries.getOrgSettings, { orgId }),
  ]);

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgSettings = settings ?? {
    businessName: "Your Business",
    orgId,
  };

  const pdfBytes = await generatePurchaseStatementPdf({
    invoiceNumber: data.invoiceNumber ?? undefined,
    year: data.year,
    editionName: data.editionName,
    createdAt: data.purchase._creationTime,
    contact: {
      company: data.contact?.company ?? undefined,
      firstName: data.contact?.firstName ?? "",
      lastName: data.contact?.lastName ?? "",
      email: data.contact?.email ?? undefined,
      phone: data.contact?.phone ?? undefined,
      address: data.contact?.address ?? undefined,
    },
    orgSettings,
    startingBalance: data.startingBalance,
    ledgerEntries: data.ledgerEntries,
    pastDueAmount: data.pastDueAmount,
    nextPaymentDueDate: data.nextPaymentDueDate,
    nextPaymentAmount: data.nextPaymentAmount,
    totalAmountDue: data.totalAmountDue,
    terms: data.terms
      ? {
          dueDayOfMonth: data.terms.dueDayOfMonth,
          lateFeeAmount: data.terms.lateFeeAmount,
          lateFeeType: data.terms.lateFeeType,
        }
      : undefined,
  });

  const contactName =
    data.contact?.company ||
    `${data.contact?.firstName ?? ""}-${data.contact?.lastName ?? ""}`;
  const filename = `statement-${contactName}-${data.year}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
