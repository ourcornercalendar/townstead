import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  isScheduledPaymentLate,
  computeScheduledPaymentPaid,
} from "../billing/helpers";
import { isOwnDoc } from "../auth.helpers";

export const listByPurchase = query({
  args: { purchaseId: v.id("purchases"), now: v.number() },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.purchaseId)))) return [];
    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", args.purchaseId)
      )
      .collect();

    const now = args.now;
    const enriched = await Promise.all(
      scheduledPayments.map(async (sp) => {
        const allocations = await ctx.db
          .query("paymentAllocations")
          .withIndex("by_scheduledPaymentId", (q) =>
            q.eq("scheduledPaymentId", sp._id)
          )
          .collect();

        return {
          ...sp,
          paidAmount: computeScheduledPaymentPaid(sp._id, allocations),
          isLate: isScheduledPaymentLate(sp, allocations, now),
        };
      })
    );

    return enriched.sort((a, b) => a.dueDate - b.dueDate);
  },
});
