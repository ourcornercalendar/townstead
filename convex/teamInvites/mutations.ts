import { mutation, MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requirePublicAuth } from "../auth.helpers";
import { TEAM_ASSIGNABLE_PERMISSIONS } from "../permissions";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const ASSIGNABLE = new Set<string>(TEAM_ASSIGNABLE_PERMISSIONS);

function generateToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The organisation on a sign-in token, if there is one.
 *
 * Clerk spells this differently depending on the JWT template -- `orgId`, or an
 * `o` claim that is either the id itself or an object holding it -- so this
 * mirrors what `requireAuth` accepts rather than guessing one shape.
 */
function identityOrgId(
  identity: Record<string, unknown> | null
): string | undefined {
  if (!identity) return undefined;
  const rawO = identity.o;
  return (
    (identity.orgId as string | undefined) ??
    (typeof rawO === "string" ? rawO : (rawO as { id?: string } | undefined)?.id)
  );
}

/**
 * The caller must be an org member who is not themselves operating under a
 * restricted grant.
 *
 * Org membership is the real admin boundary in this app: a staff member
 * invited here is never made a Clerk org member, so `requireAuth` already
 * refuses them everywhere. This second check covers the one way that could be
 * subverted -- someone who holds a limited grant *and* has been added to the
 * org -- so that a person given "add events" cannot use this screen to give
 * themselves more.
 */
async function requireUnrestrictedAdmin(ctx: QueryCtx | MutationCtx) {
  const auth = await requireAuth(ctx);
  const grant = await ctx.db
    .query("orgPermissions")
    .withIndex("by_userId_and_orgId", (q) =>
      q.eq("userId", auth.userId).eq("orgId", auth.orgId)
    )
    .first();
  if (grant && grant.role !== "admin") {
    throw new Error("Only an administrator can manage team access");
  }
  return auth;
}

function validatePermissions(permissions: string[]): string[] {
  // An empty list is refused rather than stored. `checkPermission` treats an
  // empty permissions array as "fall through to the organisation defaults",
  // so saving one would quietly give the person whatever the defaults happen
  // to be -- the opposite of picking exactly these boxes.
  if (permissions.length === 0) {
    throw new Error("Choose at least one thing this person can do");
  }
  const unknown = permissions.filter((p) => !ASSIGNABLE.has(p));
  if (unknown.length > 0) {
    throw new Error(`Not a permission that can be granted here: ${unknown[0]}`);
  }
  return [...new Set(permissions)];
}

export const create = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await requireUnrestrictedAdmin(ctx);

    const email = normalizeEmail(args.email);
    if (!email.includes("@")) {
      throw new Error("That doesn't look like an email address");
    }

    // Caught here as well as at redemption, because "I'll invite myself to see
    // what it does" is the obvious first thing to try, and the damage only
    // becomes visible later when the Approve button stops working.
    const ownEmail = (await ctx.auth.getUserIdentity())?.email;
    if (ownEmail && normalizeEmail(ownEmail) === email) {
      throw new Error(
        "That's your own address. Accepting a team invite would replace your " +
          "administrator access with the limited one, so this is refused. To " +
          "see what the invited person sees, use a second email address."
      );
    }

    const permissions = validatePermissions(args.permissions);

    const existing = await ctx.db
      .query("teamInvites")
      .withIndex("by_email_and_orgId", (q) =>
        q.eq("email", email).eq("orgId", orgId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existing) {
      if (existing.expiresAt > Date.now()) {
        throw new Error("There is already a pending invite for that email");
      }
      await ctx.db.patch(existing._id, { status: "expired" });
    }

    const now = Date.now();
    const token = generateToken();

    await ctx.db.insert("teamInvites", {
      orgId,
      email,
      name: args.name?.trim() || undefined,
      token,
      permissions,
      expiresAt: now + THIRTY_DAYS_MS,
      status: "pending",
      invitedByUserId: userId,
      createdAt: now,
    });

    return token;
  },
});

export const redeem = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const { userId } = await requirePublicAuth(ctx);

    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) throw new Error("Invalid invite link");

    if (invite.status !== "pending") {
      throw new Error(
        invite.status === "redeemed"
          ? "This invite has already been used"
          : invite.status === "revoked"
            ? "This invite has been withdrawn"
            : "This invite has expired"
      );
    }

    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("This invite has expired");
    }

    // An administrator accepting a team invite would be demoting herself.
    //
    // A limited grant does not sit alongside running the organisation, it
    // replaces it: every permission check consults the grant first, so the
    // moment one exists the owner loses the Team screen and the ability to
    // approve anything. Somebody testing the flow with their own account would
    // have locked themselves out of both, with no way back except the Convex
    // dashboard. This refuses instead.
    if (identityOrgId(identity) === invite.orgId) {
      throw new Error(
        "You already run this organisation — accepting a team invite would " +
          "take that away. Send the link to the person it's for, or sign out " +
          "and open it with their account."
      );
    }

    // If the sign-in carries an email, it has to be the one that was invited,
    // so a forwarded link does not become an account for whoever opened it.
    // Clerk's JWT template does not always include the claim; when it is
    // absent the secret in the link is the only thing standing there, which is
    // the same footing the advertiser portal invites have always been on.
    const claimedEmail = identity?.email;
    if (claimedEmail && normalizeEmail(claimedEmail) !== invite.email) {
      throw new Error(
        `This invite was sent to ${invite.email}. Sign in with that address to accept it.`
      );
    }

    const existingGrant = await ctx.db
      .query("orgPermissions")
      .withIndex("by_userId_and_orgId", (q) =>
        q.eq("userId", userId).eq("orgId", invite.orgId)
      )
      .first();

    if (existingGrant) {
      // Accepting a second time should not duplicate a grant, and should not
      // silently downgrade an advertiser's portal access either.
      if (existingGrant.role === "contact") {
        throw new Error(
          "This account is already linked to an advertiser portal. Use a different account for team access."
        );
      }
      await ctx.db.patch(existingGrant._id, {
        permissions: invite.permissions,
        isActive: true,
        invitedEmail: invite.email,
        invitedName: invite.name ?? existingGrant.invitedName,
      });
    } else {
      await ctx.db.insert("orgPermissions", {
        userId,
        orgId: invite.orgId,
        role: "user",
        permissions: invite.permissions,
        isActive: true,
        invitedEmail: invite.email,
        invitedName: invite.name,
      });
    }

    await ctx.db.patch(invite._id, {
      status: "redeemed",
      redeemedByUserId: userId,
      redeemedAt: Date.now(),
    });

    return { orgId: invite.orgId };
  },
});

export const revoke = mutation({
  args: { id: v.id("teamInvites") },
  handler: async (ctx, args) => {
    const { orgId } = await requireUnrestrictedAdmin(ctx);

    const invite = await ctx.db.get(args.id);
    if (!invite || invite.orgId !== orgId) throw new Error("Invite not found");
    if (invite.status !== "pending") {
      throw new Error("Only a pending invite can be withdrawn");
    }

    await ctx.db.patch(args.id, { status: "revoked" });
  },
});

/**
 * Change what an existing team member can do.
 *
 * Separate from `orgPermissions.updatePermissions` because this one refuses to
 * touch an advertiser's contact grant and refuses permissions that are not
 * assignable from the Team screen.
 */
export const updateMemberPermissions = mutation({
  args: {
    id: v.id("orgPermissions"),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireUnrestrictedAdmin(ctx);

    const grant = await ctx.db.get(args.id);
    if (!grant || grant.orgId !== orgId) throw new Error("Not found");
    if (grant.role !== "user") {
      throw new Error("That account is not a team member");
    }

    await ctx.db.patch(args.id, {
      permissions: validatePermissions(args.permissions),
    });
  },
});

export const setMemberActive = mutation({
  args: {
    id: v.id("orgPermissions"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireUnrestrictedAdmin(ctx);

    const grant = await ctx.db.get(args.id);
    if (!grant || grant.orgId !== orgId) throw new Error("Not found");
    if (grant.role !== "user") {
      throw new Error("That account is not a team member");
    }

    await ctx.db.patch(args.id, { isActive: args.isActive });
  },
});

export const removeMember = mutation({
  args: { id: v.id("orgPermissions") },
  handler: async (ctx, args) => {
    const { orgId } = await requireUnrestrictedAdmin(ctx);

    const grant = await ctx.db.get(args.id);
    if (!grant || grant.orgId !== orgId) throw new Error("Not found");
    if (grant.role !== "user") {
      throw new Error("That account is not a team member");
    }

    await ctx.db.delete(args.id);
  },
});
