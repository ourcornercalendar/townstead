import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { sendPortalInviteEmail } from "@/lib/email/send-portal-invite";

export async function POST(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { contactId, permissions } = body as {
    contactId: string;
    permissions: string[];
  };

  if (!contactId) {
    return NextResponse.json(
      { error: "Missing contactId" },
      { status: 400 }
    );
  }

  const convex = await getConvexClient();

  try {
    const token = await convex.mutation(api.portalInvites.mutations.create, {
      contactId: contactId as Id<"contacts">,
      permissions: permissions ?? [],
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const inviteUrl = `${baseUrl}/portal/invite/${token}`;

    const [contact, settings] = await Promise.all([
      convex.query(api.contacts.queries.getById, {
        id: contactId as Id<"contacts">,
      }),
      convex.query(api.settings.queries.getOrgSettings, { orgId }),
    ]);

    let emailSent = false;
    if (contact?.email) {
      try {
        await sendPortalInviteEmail({
          to: contact.email,
          orgName: settings?.businessName ?? "Your Organization",
          contactName: `${contact.firstName} ${contact.lastName}`,
          inviteUrl,
          expiresInDays: 30,
        });
        emailSent = true;
      } catch {
        // Email send failure is non-fatal; admin can still copy the link
      }
    }

    return NextResponse.json({ token, inviteUrl, emailSent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
