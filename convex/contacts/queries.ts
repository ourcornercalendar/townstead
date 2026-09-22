import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireOrg } from "../auth.helpers";

export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("contacts")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
  },
});

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);
    const normalizedId = ctx.db.normalizeId("contacts", args.id);
    if (!normalizedId) return null;
    const contact = await ctx.db.get(normalizedId);
    // A contact from another organisation is "not found" rather than hidden:
    // returning null says nothing about whether the id exists.
    if (!contact || contact.orgId !== orgId) return null;
    return contact;
  },
});

export const search = query({
  args: { orgId: v.string(), searchTerm: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("contacts")
      .withSearchIndex("search_contacts", (q) =>
        q.search("searchText", args.searchTerm).eq("orgId", args.orgId)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
  },
});
