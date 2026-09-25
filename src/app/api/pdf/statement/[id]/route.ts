import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { generateStatementPdf } from "@/lib/pdf/statement";

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
    convex.query(api.billing.queries.getStatementData, {
      contactId: id as Id<"contacts">,
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

  const pdfBytes = await generateStatementPdf({
    contact: {
      company: data.contact.company ?? undefined,
      firstName: data.contact.firstName,
      lastName: data.contact.lastName,
      email: data.contact.email ?? undefined,
      address: data.contact.address ?? undefined,
    },
    orgSettings,
    purchases: data.purchases.map((p) => ({
      invoiceNumber: p.invoiceNumber ?? undefined,
      editionName: p.editionName,
      year: p.year,
      net: p.net,
      amountPaid: p.amountPaid,
      balance: p.balance,
    })),
    payments: data.payments.map((p) => ({
      date: p.date,
      amount: p.amount,
      method: p.method ?? undefined,
      invoiceNumber: p.invoiceNumber ?? undefined,
      editionName: p.editionName,
      year: p.year,
    })),
    overallBalance: data.overallBalance,
    statementMessage: data.statementMessage,
  });

  const contactName =
    data.contact.company ||
    `${data.contact.firstName}-${data.contact.lastName}`;
  const filename = `statement-${contactName}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
