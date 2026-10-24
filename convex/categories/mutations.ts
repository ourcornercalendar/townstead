import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireWorkspacePermission } from "../auth.helpers";
import { PERMISSIONS } from "../permissions";

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
    // Was requireOrg: Clerk organisation members only, which meant category
    // work could never be handed to a helper however much the owner wanted
    // to. An org member with no grant still passes this as before.
    await requireWorkspacePermission(ctx, args.orgId, PERMISSIONS.CATEGORIES_CREATE);
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
    // asked for, so any id works. Reading the row first and checking against
    // ITS orgId is what refuses anything not ours — the permission check
    // then runs against that same org.
    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Not found");
    await requireWorkspacePermission(ctx, category.orgId, PERMISSIONS.CATEGORIES_UPDATE);
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const softDelete = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    // See `update` above on why the row is read before the check.
    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Not found");
    await requireWorkspacePermission(ctx, category.orgId, PERMISSIONS.CATEGORIES_DELETE);
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
