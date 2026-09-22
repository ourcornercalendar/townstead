import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, isOwnDoc } from "../auth.helpers";

export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("events")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    return await ctx.db.get(args.id);
  },
});

export const listByDateRange = query({
  args: {
    orgId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("events")
      .withIndex("by_orgId_and_date", (q) =>
        q.eq("orgId", args.orgId).gte("date", args.startDate).lte("date", args.endDate)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
  },
});
