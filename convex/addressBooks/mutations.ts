import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, requireOwnDoc } from "../auth.helpers";

export const create = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    displayLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db.insert("addressBooks", {
      name: args.name,
      displayLevel: args.displayLevel,
      orgId: args.orgId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("addressBooks"),
    name: v.string(),
    displayLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    await ctx.db.patch(args.id, {
      name: args.name,
      displayLevel: args.displayLevel,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("addressBooks") },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    await ctx.db.delete(args.id);
  },
});
