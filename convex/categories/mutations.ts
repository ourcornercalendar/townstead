import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, requireOwnDoc } from "../auth.helpers";

export const create = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("event"),
      v.literal("blog"),
      v.literal("video"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db.insert("categories", {
      ...args,
      isDeleted: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const softDelete = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    await ctx.db.patch(args.id, { isDeleted: true });
  },
});

export const seedBusinessCategories = internalMutation({
  args: {
    orgId: v.string(),
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_orgId_and_type", (q) =>
        q.eq("orgId", args.orgId).eq("type", "business")
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const existingNames = new Set(existing.map((c) => c.name));
    let inserted = 0;

    for (const name of args.names) {
      if (existingNames.has(name)) continue;
      await ctx.db.insert("categories", {
        name,
        type: "business",
        orgId: args.orgId,
        isDeleted: false,
      });
      inserted++;
    }

    return { inserted, skipped: args.names.length - inserted };
  },
});
