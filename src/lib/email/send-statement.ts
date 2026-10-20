import { getResend, EMAIL_FROM } from "./resend";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { generateStatementPdf } from "@/lib/pdf/statement";
import { StatementEmail } from "@/emails/statement-email";
import { render } from "@react-email/components";

export async function sendStatementEmail(
  contactId: Id<"contacts">,
  orgId: string
) {
  const convex = await getConvexClient();

  const [data, settings] = await Promise.all([
    convex.query(api.billing.queries.getStatementData, {
      contactId,
      orgId,
      now: Date.now(),
    }),
    convex.query(api.settings.queries.getOrgSettings, { orgId }),
  ]);

  if (!data) throw new Error("Statement data not found");
  if (!data.contact.email) throw new Error("Contact has no email address");

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

  const contactName = `${data.contact.firstName} ${data.contact.lastName}`;
  const companyName = data.contact.company ?? contactName;

  const html = await render(
    StatementEmail({
      contactName,
      companyName,
      overallBalance: data.overallBalance,
      purchaseCount: data.purchases.length,
    })
  );

  const resend = getResend();
  await resend.emails.send({
    from: EMAIL_FROM,
    to: data.contact.email,
    subject: `Account Statement — ${companyName}`,
    html,
    attachments: [
      {
        filename: `statement-${companyName}.pdf`,
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ],
  });
}
