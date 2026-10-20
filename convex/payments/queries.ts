import { query } from "../_generated/server";
import { v } from "convex/values";
import { isOwnDoc } from "../auth.helpers";

export const listByPurchase = query({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.purchaseId)))) return [];
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.purchaseId))
      .collect();

    const withAllocations = await Promise.all(
      payments.map(async (payment) => {
        const allocations = await ctx.db
          .query("paymentAllocations")
          .withIndex("by_paymentId", (q) => q.eq("paymentId", payment._id))
          .collect();
        return { ...payment, allocations };
      })
    );

    return withAllocations.sort((a, b) => b.date - a.date);
  },
});

export const listByContact = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.contactId)))) return [];
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_contactId", (q) => q.eq("contactId", args.contactId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const allPayments = [];
    for (const purchase of purchases) {
      const edition = purchase.calendarEditionIds.length > 0
        ? await ctx.db.get(purchase.calendarEditionIds[0])
        : null;
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", purchase._id)
        )
        .collect();

      for (const payment of payments) {
        allPayments.push({
          ...payment,
          invoiceNumber: purchase.invoiceNumber,
          editionName: edition?.name ?? "Unknown",
          year: purchase.year,
        });
      }
    }

    return allPayments.sort((a, b) => b.date - a.date);
  },
});
