import { query } from "../_generated/server";
import { v } from "convex/values";
import { isOwnDoc } from "../auth.helpers";

export const listByAdvertisement = query({
  args: { advertisementId: v.id("advertisements") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.advertisementId)))) return [];
    return await ctx.db
      .query("adPricing")
      .withIndex("by_advertisementId", (q) =>
        q.eq("advertisementId", args.advertisementId)
      )
      .collect();
  },
});

export const getByAdEditionYear = query({
  args: {
    advertisementId: v.id("advertisements"),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.advertisementId)))) return null;
    return await ctx.db
      .query("adPricing")
      .withIndex("by_advertisementId_and_calendarEditionId_and_year", (q) =>
        q
          .eq("advertisementId", args.advertisementId)
          .eq("calendarEditionId", args.calendarEditionId)
          .eq("year", args.year)
      )
      .first();
  },
});
