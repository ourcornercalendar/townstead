import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, requireOwnDoc } from "../auth.helpers";

export const create = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    isDayType: v.boolean(),
    slotsPerMonth: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db.insert("advertisements", {
      name: args.name,
      isDayType: args.isDayType,
      slotsPerMonth: args.slotsPerMonth,
      orgId: args.orgId,
      isDeleted: false,
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("advertisements") },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    await ctx.db.patch(args.id, { isDeleted: true });
  },
});
