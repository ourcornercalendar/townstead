import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg } from "../auth.helpers";

export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("addressBooks")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});
