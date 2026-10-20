import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, resolveEffectivePermissions } from "../auth.helpers";
import { PERMISSIONS } from "../permissions";

/**
 * Open on purpose: the person accepting an invite is not signed in yet, and
 * this is what the acceptance page shows them before they do. It returns the
 * organisation's name and the invited address and nothing else -- no user ids,
 * no other invites -- and only to someone already holding the 32-character
 * token.
 */
export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      return { valid: false, error: "Invalid invite link" } as const;
    }

    if (invite.status !== "pending") {
      const error =
        invite.status === "redeemed"
          ? "This invite has already been used"
          : invite.status === "revoked"
            ? "This invite has been withdrawn"
            : "This invite has expired";
      return { valid: false, error } as const;
    }

    if (invite.expiresAt < Date.now()) {
      return { valid: false, error: "This invite has expired" } as const;
    }

    const settings = await ctx.db
      .query("orgSettings")
      .withIndex("by_orgId", (q) => q.eq("orgId", invite.orgId))
      .first();

    const branding = await ctx.db
      .query("tenantBranding")
      .withIndex("by_orgId", (q) => q.eq("orgId", invite.orgId))
      .first();

    return {
      valid: true,
      orgName:
        settings?.businessName ?? branding?.siteName ?? "the organization",
      orgSlug: branding?.orgSlug,
      email: invite.email,
      name: invite.name,
      permissions: invite.permissions,
    } as const;
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuth(ctx);

    const invites = await ctx.db
      .query("teamInvites")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const now = Date.now();
    return invites
      .filter((i) => i.status === "pending" && i.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Everyone this organisation has given limited access to.
 *
 * Contact grants are excluded: those belong to advertisers and are managed on
 * the contact's own page, not here.
 */
export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuth(ctx);

    const grants = await ctx.db
      .query("orgPermissions")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    return grants.filter((g) => g.role === "user");
  },
});

/**
 * Where a signed-in person with limited access should be sent.
 *
 * Someone invited to add events is not an org member, so `/admin` is closed to
 * them and the sign-in redirect would otherwise drop them on the public home
 * page with no indication of what they are supposed to do.
 */
export const myTeamLanding = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const grant = await ctx.db
      .query("orgPermissions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .filter((q) =>
        q.and(q.eq(q.field("role"), "user"), q.eq(q.field("isActive"), true))
      )
      .first();

    if (!grant) return null;

    const canPostEvents =
      grant.permissions.includes("events:create") ||
      grant.permissions.includes("events:submit");
    if (!canPostEvents) return null;

    const branding = await ctx.db
      .query("tenantBranding")
      .withIndex("by_orgId", (q) => q.eq("orgId", grant.orgId))
      .first();
    if (!branding) return null;

    return { orgSlug: branding.orgSlug };
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);
    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invite || invite.orgId !== orgId) return null;
    return invite;
  },
});

/**
 * What the events desk needs to know about the person standing at it.
 *
 * Returns null for anyone without an active team grant -- including the
 * organisation's own administrators, who have the full admin screens and no
 * business being sent here.
 */
export const myWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const grant = await ctx.db
      .query("orgPermissions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .filter((q) =>
        q.and(q.eq(q.field("role"), "user"), q.eq(q.field("isActive"), true))
      )
      .first();
    if (!grant) return null;

    const { permissions } = await resolveEffectivePermissions(
      ctx,
      identity.subject,
      grant.orgId
    );

    const canCreate = permissions.includes(PERMISSIONS.EVENTS_CREATE);
    const canSubmit = permissions.includes(PERMISSIONS.EVENTS_SUBMIT);
    if (!canCreate && !canSubmit) return null;

    const branding = await ctx.db
      .query("tenantBranding")
      .withIndex("by_orgId", (q) => q.eq("orgId", grant.orgId))
      .first();
    const settings = await ctx.db
      .query("orgSettings")
      .withIndex("by_orgId", (q) => q.eq("orgId", grant.orgId))
      .first();

    return {
      orgId: grant.orgId,
      orgName: settings?.businessName ?? branding?.siteName ?? "the calendar",
      // Straight onto the calendar, or into the approvals queue.
      publishesImmediately: canCreate,
      canManageAll: permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL),
      canEditOwn:
        permissions.includes(PERMISSIONS.EVENTS_UPDATE_OWN) ||
        permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL),
      canDeleteOwn:
        permissions.includes(PERMISSIONS.EVENTS_DELETE_OWN) ||
        permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL),
      name: grant.invitedName ?? null,
    };
  },
});
