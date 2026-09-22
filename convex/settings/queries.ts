import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg } from "../auth.helpers";

export const getOrgSettings = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("orgSettings")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});
