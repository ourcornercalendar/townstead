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

/**
 * Save the running order of the advertisement list.
 *
 * Takes the full list in its new order and numbers it 0, 1, 2… rather than
 * nudging one row's number. Two reasons: it heals whatever gaps or duplicates
 * an earlier version left behind, and it means a move is one write of a known
 * final state instead of two rows swapping and racing each other.
 *
 * Ids that are not this organisation's are refused outright -- not skipped --
 * because a partial reorder is a worse answer than none.
 */
export const reorder = mutation({
  args: { orgId: v.string(), orderedIds: v.array(v.id("advertisements")) },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);

    const docs = await Promise.all(args.orderedIds.map((id) => ctx.db.get(id)));
    docs.forEach((doc, i) => {
      if (!doc || doc.orgId !== args.orgId) {
        throw new Error(`Not found: ${args.orderedIds[i]}`);
      }
    });

    await Promise.all(
      args.orderedIds.map((id, index) =>
        ctx.db.patch(id, { displayOrder: index })
      )
    );
  },
});
