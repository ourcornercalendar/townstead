import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, isOwnDoc } from "../auth.helpers";

export const list = query({
  args: {
    orgId: v.string(),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("pending"), v.literal("published"))
    ),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    if (args.status) {
      return await ctx.db
        .query("blogPosts")
        .withIndex("by_orgId_and_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", args.status!)
        )
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .collect();
    }

    return await ctx.db
      .query("blogPosts")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: {
    orgId: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("blogPosts")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .first();
  },
});
