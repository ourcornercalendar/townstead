import { QueryCtx, MutationCtx } from "./_generated/server";

type AuthCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export interface OrgAuth {
  userId: string;
  orgId: string;
}

/**
 * Extracts and validates auth for org-scoped operations.
 * Requires a Clerk org membership (orgId in JWT).
 */
export async function requireAuth(ctx: AuthCtx): Promise<OrgAuth> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const rawO = (identity as Record<string, unknown>).o;
  const orgId =
    (identity.orgId as string | undefined) ??
    (typeof rawO === "string" ? rawO : (rawO as { id?: string } | undefined)?.id);
  if (!orgId) throw new Error("No organization selected");
  return { userId: identity.subject, orgId };
}

/**
 * Extracts auth for public-facing operations where the user
 * is not an org member. Only validates that the user is signed in.
 */
export async function requirePublicAuth(
  ctx: AuthCtx
): Promise<{ userId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return { userId: identity.subject };
}

/**
 * Authenticates, and confirms the caller actually belongs to the organisation
 * they are asking about.
 *
 * Nearly every admin query and mutation takes `orgId` as an argument. Without
 * this, that argument is simply believed: a Convex `query` or `mutation` is a
 * public endpoint, and the deployment URL ships in the client bundle, so
 * anything that does not check the caller's identity can be called by anyone
 * who opens the site and passes whatever orgId they like.
 */
export async function requireOrg(
  ctx: AuthCtx,
  orgId: string
): Promise<OrgAuth> {
  const auth = await requireAuth(ctx);
  if (auth.orgId !== orgId) {
    throw new Error("Not authorized for this organization");
  }
  return auth;
}

/**
 * Does this document belong to the caller's organisation?
 *
 * For queries. A query that used to return null for a missing id must keep
 * doing so -- throwing instead would turn "not found" into an error state in
 * every screen that checks for null. So this reports, and the caller decides
 * what empty looks like.
 */
export async function isOwnDoc(
  ctx: AuthCtx,
  doc: { orgId?: string } | null
): Promise<boolean> {
  const { orgId } = await requireAuth(ctx);
  if (!doc) return false;
  return doc.orgId === undefined || doc.orgId === orgId;
}

/**
 * Authenticates and confirms a document belongs to the caller's organisation.
 *
 * For the handlers that take only a document id. Looking a record up by id
 * alone crosses org boundaries by default -- the id is the only thing asked
 * for, so any id works.
 */
export async function requireOwnDoc<T extends { orgId?: string }>(
  ctx: AuthCtx,
  doc: T | null
): Promise<T | null> {
  const { orgId } = await requireAuth(ctx);
  // A document that exists but belongs to someone else is refused. A document
  // that does not exist is passed straight through, so the handler's own
  // "Contact not found" (or whatever it says) still fires with its own
  // wording -- this guard is here to add a check, not to take one over.
  if (doc && doc.orgId !== undefined && doc.orgId !== orgId) {
    throw new Error("Not found");
  }
  return doc;
}

/**
 * Checks whether a user has a specific permission within an org.
 *
 * Resolution order:
 * 1. Look up explicit orgPermissions grant for user+org
 * 2. If grant exists and is active, check its permissions array
 * 3. If no grant exists, fall back to orgPermissionDefaults for the org
 * 4. Admin role users (org members) implicitly have all permissions
 */
export async function checkPermission(
  ctx: AuthCtx,
  userId: string,
  orgId: string,
  permission: string
): Promise<boolean> {
  const grant = await ctx.db
    .query("orgPermissions")
    .withIndex("by_userId_and_orgId", (q) =>
      q.eq("userId", userId).eq("orgId", orgId)
    )
    .first();

  if (grant) {
    if (!grant.isActive) return false;
    if (grant.role === "admin") return true;
    if (grant.permissions.length > 0) {
      return grant.permissions.includes(permission);
    }
    // Empty permissions array = fall through to defaults for this role
    const defaults = await ctx.db
      .query("orgPermissionDefaults")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .first();
    if (!defaults) return false;
    const defaultPerms =
      grant.role === "contact" ?
        defaults.contactDefaults
      : defaults.userDefaults;
    return defaultPerms.includes(permission);
  }

  // No explicit grant — check org defaults for "user" role
  const defaults = await ctx.db
    .query("orgPermissionDefaults")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .first();
  if (!defaults) return false;
  return defaults.userDefaults.includes(permission);
}

/**
 * Like checkPermission but throws if the user lacks the permission.
 */
export async function requirePermission(
  ctx: AuthCtx,
  userId: string,
  orgId: string,
  permission: string
): Promise<void> {
  const allowed = await checkPermission(ctx, userId, orgId, permission);
  if (!allowed) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Resolves the effective permissions list for a user within an org.
 * Used when multiple permissions need to be checked together (tiered logic).
 */
export async function resolveEffectivePermissions(
  ctx: AuthCtx,
  userId: string,
  orgId: string
): Promise<{ permissions: string[]; isAdmin: boolean }> {
  const grant = await ctx.db
    .query("orgPermissions")
    .withIndex("by_userId_and_orgId", (q) =>
      q.eq("userId", userId).eq("orgId", orgId)
    )
    .first();

  if (grant) {
    if (!grant.isActive) return { permissions: [], isAdmin: false };
    if (grant.role === "admin") return { permissions: [], isAdmin: true };

    if (grant.permissions.length > 0) {
      return { permissions: grant.permissions, isAdmin: false };
    }

    const defaults = await ctx.db
      .query("orgPermissionDefaults")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .first();
    if (!defaults) return { permissions: [], isAdmin: false };
    const defaultPerms =
      grant.role === "contact" ?
        defaults.contactDefaults
      : defaults.userDefaults;
    return { permissions: defaultPerms, isAdmin: false };
  }

  const defaults = await ctx.db
    .query("orgPermissionDefaults")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .first();
  if (!defaults) return { permissions: [], isAdmin: false };
  return { permissions: defaults.userDefaults, isAdmin: false };
}

export interface CreateActionResult {
  allowed: boolean;
  needsApproval: boolean;
}

/**
 * Checks whether a user can create content in a tiered domain
 * and whether approval is required.
 *
 * - `{domain}:create` = auto-approved (supersedes submit)
 * - `{domain}:submit` = requires approval
 * - Neither = not allowed
 * - Admin role = auto-approved, no approval needed
 */
export async function checkCreateAction(
  ctx: AuthCtx,
  userId: string,
  orgId: string,
  domain: string
): Promise<CreateActionResult> {
  const { permissions, isAdmin } = await resolveEffectivePermissions(
    ctx,
    userId,
    orgId
  );

  if (isAdmin) {
    return { allowed: true, needsApproval: false };
  }

  const hasCreate = permissions.includes(`${domain}:create`);
  const hasSubmit = permissions.includes(`${domain}:submit`);

  if (hasCreate) {
    return { allowed: true, needsApproval: false };
  }
  if (hasSubmit) {
    return { allowed: true, needsApproval: true };
  }
  return { allowed: false, needsApproval: false };
}

/**
 * Like checkCreateAction but throws if the user cannot create at all.
 * Returns whether approval is required.
 */
export async function requireCreateAction(
  ctx: AuthCtx,
  userId: string,
  orgId: string,
  domain: string
): Promise<{ needsApproval: boolean }> {
  const result = await checkCreateAction(ctx, userId, orgId, domain);
  if (!result.allowed) {
    throw new Error(`Permission denied: ${domain}:create`);
  }
  return { needsApproval: result.needsApproval };
}
