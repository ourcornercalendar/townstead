import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg } from "../auth.helpers";

const addressValidator = v.optional(
  v.object({
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
  })
);

export const upsertOrgSettings = mutation({
  args: {
    orgId: v.string(),
    businessName: v.string(),
    address: addressValidator,
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    publisherName: v.optional(v.string()),
    remitToName: v.optional(v.string()),
    remitToAddress: addressValidator,
    showCreditCardSection: v.optional(v.boolean()),
    nsfFeeAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const { orgId, ...fields } = args;

    const existing = await ctx.db
      .query("orgSettings")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("orgSettings", { orgId, ...fields });
  },
});
