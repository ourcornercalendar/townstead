import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg } from "../auth.helpers";

const monthlyPricesValidator = v.object({
  jan: v.number(),
  feb: v.number(),
  mar: v.number(),
  apr: v.number(),
  may: v.number(),
  jun: v.number(),
  jul: v.number(),
  aug: v.number(),
  sep: v.number(),
  oct: v.number(),
  nov: v.number(),
  dec: v.number(),
});

export const upsert = mutation({
  args: {
    orgId: v.string(),
    advertisementId: v.id("advertisements"),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
    monthlyPrices: monthlyPricesValidator,
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const existing = await ctx.db
      .query("adPricing")
      .withIndex("by_advertisementId_and_calendarEditionId_and_year", (q) =>
        q
          .eq("advertisementId", args.advertisementId)
          .eq("calendarEditionId", args.calendarEditionId)
          .eq("year", args.year)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { monthlyPrices: args.monthlyPrices });
      return existing._id;
    }

    return await ctx.db.insert("adPricing", {
      advertisementId: args.advertisementId,
      calendarEditionId: args.calendarEditionId,
      year: args.year,
      monthlyPrices: args.monthlyPrices,
      orgId: args.orgId,
    });
  },
});
