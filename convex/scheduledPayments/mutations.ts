import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireOwnDoc } from "../auth.helpers";

export const waiveLateFee = mutation({
  args: {
    id: v.id("scheduledPayments"),
    waived: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    const sp = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { lateFeeWaived: args.waived });

    if (sp) {
      const purchase = await ctx.db.get(sp.purchaseId);
      if (purchase && !purchase.isDeleted) {
        for (const calendarEditionId of purchase.calendarEditionIds) {
          await ctx.scheduler.runAfter(
            0,
            internal.dashboard.mutations.recomputeStatsCache,
            {
              orgId: purchase.orgId,
              calendarEditionId,
              year: purchase.year,
            }
          );
        }
      }
    }
  },
});
