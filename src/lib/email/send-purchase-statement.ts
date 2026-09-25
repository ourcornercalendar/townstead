import { getResend, EMAIL_FROM } from "./resend";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { generatePurchaseStatementPdf } from "@/lib/pdf/purchase-statement";
import { StatementEmail } from "@/emails/statement-email";
import { render } from "@react-email/components";

export async function sendPurchaseStatementEmail(
  purchaseId: Id<"purchases">,
  orgId: string
) {
  const convex = await getConvexClient();

  const [data, settings] = await Promise.all([
    convex.query(api.billing.queries.getStatementDataByPurchase, {
      purchaseId,
      orgId,
      now: Date.now(),
    }),
    convex.query(api.settings.queries.getOrgSettings, { orgId }),
  ]);

  if (!data) throw new Error("Statement data not found");
  if (!data.contact?.email) throw new Error("Contact has no email address");

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
      company: data.contact.company ?? undefined,
      firstName: data.contact.firstName,
      lastName: data.contact.lastName,
      email: data.contact.email ?? undefined,
      phone: data.contact.phone ?? undefined,
      address: data.contact.address ?? undefined,
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

  const contactName = `${data.contact.firstName} ${data.contact.lastName}`;
  const companyName = data.contact.company ?? contactName;

  const html = await render(
    StatementEmail({
      contactName,
      companyName,
      overallBalance: data.balance,
      purchaseCount: 1,
    })
  );

  const resend = getResend();
  await resend.emails.send({
    from: EMAIL_FROM,
    to: data.contact.email,
    subject: `Statement — Invoice #${data.invoiceNumber ?? "N/A"} — ${companyName}`,
    html,
    attachments: [
      {
        filename: `statement-${companyName}-${data.year}.pdf`,
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ],
  });
}
