import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireOrg } from "../auth.helpers";

async function resolveStorageUrl(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  id?: Id<"_storage">,
): Promise<string | null> {
  if (!id) return null;
  return await ctx.storage.getUrl(id);
}

export const getByOrgId = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db
      .query("tenantBranding")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .unique();
    if (!doc) return null;
    return {
      ...doc,
      logoUrl: await resolveStorageUrl(ctx, doc.logo),
      heroImageUrl: await resolveStorageUrl(ctx, doc.heroImage),
    };
  },
});

export const getBySlug = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("tenantBranding")
      .withIndex("by_orgSlug", (q) => q.eq("orgSlug", args.orgSlug))
      .unique();
    if (!doc) return null;
    return {
      ...doc,
      logoUrl: await resolveStorageUrl(ctx, doc.logo),
      heroImageUrl: await resolveStorageUrl(ctx, doc.heroImage),
    };
  },
});
