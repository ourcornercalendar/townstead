import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  generateInvoiceNumber,
  computeScheduleBase,
  generateScheduledPayments,
} from "../billing/helpers";
import { requireOrg, requireOwnDoc } from "../auth.helpers";

async function invalidateStatsCache(
  ctx: MutationCtx,
  orgId: string,
  calendarEditionIds: Id<"calendarEditions">[],
  year: number
) {
  for (const calendarEditionId of calendarEditionIds) {
    await ctx.scheduler.runAfter(
      0,
      internal.dashboard.mutations.recomputeStatsCache,
      { orgId, calendarEditionId, year }
    );
  }
}

const adSelectionValidator = v.object({
  advertisementId: v.id("advertisements"),
  calendarEditionId: v.id("calendarEditions"),
  quantity: v.number(),
  charge: v.optional(v.number()),
  slots: v.array(
    v.object({
      month: v.number(),
      slotNumber: v.optional(v.number()),
      date: v.optional(v.number()),
    })
  ),
});

const paymentTermsValidator = v.object({
  totalSale: v.number(),
  discount1: v.optional(v.number()),
  discount1Label: v.optional(v.string()),
  discount2: v.optional(v.number()),
  discount2Label: v.optional(v.string()),
  additionalSale1: v.optional(v.number()),
  additionalSale1Label: v.optional(v.string()),
  additionalSale2: v.optional(v.number()),
  additionalSale2Label: v.optional(v.string()),
  trade: v.optional(v.number()),
  earlyDiscountType: v.optional(
    v.union(v.literal("flat"), v.literal("percent"))
  ),
  earlyDiscountAmount: v.optional(v.number()),
  lateFeeType: v.optional(
    v.union(v.literal("flat"), v.literal("percent"))
  ),
  lateFeeAmount: v.optional(v.number()),
  dueDayOfMonth: v.optional(v.number()),
  splitEqually: v.optional(v.boolean()),
  scheduleStartMonth: v.optional(v.number()),
  scheduleStartYear: v.optional(v.number()),
  scheduleEndMonth: v.optional(v.number()),
  scheduleEndYear: v.optional(v.number()),
  customSchedule: v.optional(
    v.array(
      v.object({
        month: v.number(),
        year: v.number(),
        amount: v.number(),
      })
    )
  ),
  deliveryMethod: v.optional(v.string()),
  invoiceMessage: v.optional(v.string()),
  statementMessage: v.optional(v.string()),
});

export const create = mutation({
  args: {
    orgId: v.string(),
    contactId: v.id("contacts"),
    calendarEditionIds: v.array(v.id("calendarEditions")),
    year: v.number(),
    adSelections: v.array(adSelectionValidator),
    paymentTerms: paymentTermsValidator,
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const invoiceNumber = await generateInvoiceNumber(
      ctx.db,
      args.year,
      args.orgId
    );

    const now = Date.now();
    const purchaseId = await ctx.db.insert("purchases", {
      contactId: args.contactId,
      calendarEditionIds: args.calendarEditionIds,
      year: args.year,
      invoiceNumber,
      orgId: args.orgId,
      isDeleted: false,
      updatedAt: now,
    });

    await ctx.db.insert("paymentTerms", {
      purchaseId,
      ...args.paymentTerms,
      orgId: args.orgId,
      updatedAt: now,
    });

    for (const sel of args.adSelections) {
      const ad = await ctx.db.get(sel.advertisementId);
      const isDayType = ad?.isDayType ?? false;

      const adPurchaseId = await ctx.db.insert("adPurchases", {
        purchaseId,
        advertisementId: sel.advertisementId,
        calendarEditionId: sel.calendarEditionId,
        quantity: sel.quantity,
        charge: sel.charge,
        orgId: args.orgId,
      });

      for (const slot of sel.slots) {
        if (slot.slotNumber != null && !isDayType) {
          const existing = await ctx.db
            .query("adSlots")
            .withIndex(
              "by_calendarEdition_year_month_advertisement",
              (q) =>
                q
                  .eq("calendarEditionId", sel.calendarEditionId)
                  .eq("year", args.year)
                  .eq("month", slot.month)
                  .eq("advertisementId", sel.advertisementId)
            )
            .filter((q) => q.eq(q.field("slotNumber"), slot.slotNumber))
            .first();

          if (existing) {
            throw new Error(
              `Slot ${slot.slotNumber} for month ${slot.month} is already taken`
            );
          }
        }

        await ctx.db.insert("adSlots", {
          adPurchaseId,
          advertisementId: sel.advertisementId,
          calendarEditionId: sel.calendarEditionId,
          year: args.year,
          month: slot.month,
          slotNumber: slot.slotNumber,
          date: slot.date,
          orgId: args.orgId,
        });
      }
    }

    const scheduleBase = computeScheduleBase(args.paymentTerms);
    const scheduledPaymentInputs = generateScheduledPayments({
      baseNet: scheduleBase,
      dueDayOfMonth: args.paymentTerms.dueDayOfMonth ?? 1,
      splitEqually: args.paymentTerms.splitEqually ?? true,
      startMonth: args.paymentTerms.scheduleStartMonth ?? 1,
      startYear: args.paymentTerms.scheduleStartYear ?? args.year,
      endMonth: args.paymentTerms.scheduleEndMonth ?? 12,
      endYear: args.paymentTerms.scheduleEndYear ?? args.year,
      customSchedule: args.paymentTerms.customSchedule,
    });

    for (const sp of scheduledPaymentInputs) {
      await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: sp.dueDate,
        amount: sp.amount,
        month: sp.month,
        year: sp.year,
        orgId: args.orgId,
      });
    }

    await invalidateStatsCache(
      ctx,
      args.orgId,
      args.calendarEditionIds,
      args.year
    );

    return purchaseId;
  },
});

export const update = mutation({
  args: {
    id: v.id("purchases"),
    contactId: v.optional(v.id("contacts")),
    calendarEditionIds: v.optional(v.array(v.id("calendarEditions"))),
    year: v.optional(v.number()),
    adSelections: v.optional(v.array(adSelectionValidator)),
    paymentTerms: v.optional(paymentTermsValidator),
  },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    const purchase = await ctx.db.get(args.id);
    if (!purchase) throw new Error("Purchase not found");

    const updatedEditionIds =
      args.calendarEditionIds ?? purchase.calendarEditionIds;
    const updatedYear = args.year ?? purchase.year;
    const now = Date.now();

    const patchFields: Record<string, unknown> = { updatedAt: now };
    if (args.contactId) patchFields.contactId = args.contactId;
    if (args.calendarEditionIds)
      patchFields.calendarEditionIds = args.calendarEditionIds;
    if (args.year) patchFields.year = args.year;
    await ctx.db.patch(args.id, patchFields);

    if (args.paymentTerms) {
      const existingTerms = await ctx.db
        .query("paymentTerms")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.id))
        .first();

      if (existingTerms) {
        await ctx.db.replace(existingTerms._id, {
          purchaseId: args.id,
          ...args.paymentTerms,
          orgId: purchase.orgId,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("paymentTerms", {
          purchaseId: args.id,
          ...args.paymentTerms,
          orgId: purchase.orgId,
          updatedAt: now,
        });
      }

      const oldScheduledPayments = await ctx.db
        .query("scheduledPayments")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.id))
        .collect();

      for (const sp of oldScheduledPayments) {
        const allocations = await ctx.db
          .query("paymentAllocations")
          .withIndex("by_scheduledPaymentId", (q) =>
            q.eq("scheduledPaymentId", sp._id)
          )
          .collect();
        for (const alloc of allocations) {
          await ctx.db.delete(alloc._id);
        }
        await ctx.db.delete(sp._id);
      }

      const scheduleBase = computeScheduleBase(args.paymentTerms);
      const scheduledPaymentInputs = generateScheduledPayments({
        baseNet: scheduleBase,
        dueDayOfMonth: args.paymentTerms.dueDayOfMonth ?? 1,
        splitEqually: args.paymentTerms.splitEqually ?? true,
        startMonth: args.paymentTerms.scheduleStartMonth ?? 1,
        startYear: args.paymentTerms.scheduleStartYear ?? updatedYear,
        endMonth: args.paymentTerms.scheduleEndMonth ?? 12,
        endYear: args.paymentTerms.scheduleEndYear ?? updatedYear,
        customSchedule: args.paymentTerms.customSchedule,
      });

      for (const sp of scheduledPaymentInputs) {
        await ctx.db.insert("scheduledPayments", {
          purchaseId: args.id,
          dueDate: sp.dueDate,
          amount: sp.amount,
          month: sp.month,
          year: sp.year,
          orgId: purchase.orgId,
        });
      }
    }

    if (args.adSelections) {
      const oldAdPurchases = await ctx.db
        .query("adPurchases")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.id))
        .collect();

      for (const ap of oldAdPurchases) {
        const slots = await ctx.db
          .query("adSlots")
          .withIndex("by_adPurchaseId", (q) =>
            q.eq("adPurchaseId", ap._id)
          )
          .collect();
        for (const slot of slots) {
          await ctx.db.delete(slot._id);
        }
        await ctx.db.delete(ap._id);
      }

      for (const sel of args.adSelections) {
        const ad = await ctx.db.get(sel.advertisementId);
        const isDayType = ad?.isDayType ?? false;

        const adPurchaseId = await ctx.db.insert("adPurchases", {
          purchaseId: args.id,
          advertisementId: sel.advertisementId,
          calendarEditionId: sel.calendarEditionId,
          quantity: sel.quantity,
          charge: sel.charge,
          orgId: purchase.orgId,
        });

        for (const slot of sel.slots) {
          if (slot.slotNumber != null && !isDayType) {
            const existing = await ctx.db
              .query("adSlots")
              .withIndex(
                "by_calendarEdition_year_month_advertisement",
                (q) =>
                  q
                    .eq("calendarEditionId", sel.calendarEditionId)
                    .eq("year", updatedYear)
                    .eq("month", slot.month)
                    .eq("advertisementId", sel.advertisementId)
              )
              .filter((q) => q.eq(q.field("slotNumber"), slot.slotNumber))
              .first();

            if (existing) {
              throw new Error(
                `Slot ${slot.slotNumber} for month ${slot.month} is already taken`
              );
            }
          }

          await ctx.db.insert("adSlots", {
            adPurchaseId,
            advertisementId: sel.advertisementId,
            calendarEditionId: sel.calendarEditionId,
            year: updatedYear,
            month: slot.month,
            slotNumber: slot.slotNumber,
            date: slot.date,
            orgId: purchase.orgId,
          });
        }
      }
    }

    const allEditionIds = new Set([
      ...purchase.calendarEditionIds,
      ...updatedEditionIds,
    ]);
    await invalidateStatsCache(
      ctx,
      purchase.orgId,
      [...allEditionIds],
      updatedYear
    );
    if (updatedYear !== purchase.year) {
      await invalidateStatsCache(
        ctx,
        purchase.orgId,
        [...allEditionIds],
        purchase.year
      );
    }
  },
});

export const toggleArtworkSubmitted = mutation({
  args: {
    id: v.id("purchases"),
    hasSubmittedArtwork: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    const purchase = await ctx.db.get(args.id);
    if (!purchase) throw new Error("Purchase not found");
    await ctx.db.patch(args.id, {
      hasSubmittedArtwork: args.hasSubmittedArtwork,
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("purchases") },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    const purchase = await ctx.db.get(args.id);
    if (!purchase) throw new Error("Purchase not found");

    const adPurchases = await ctx.db
      .query("adPurchases")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.id))
      .collect();

    for (const ap of adPurchases) {
      const slots = await ctx.db
        .query("adSlots")
        .withIndex("by_adPurchaseId", (q) =>
          q.eq("adPurchaseId", ap._id)
        )
        .collect();
      for (const slot of slots) {
        await ctx.db.delete(slot._id);
      }
      await ctx.db.delete(ap._id);
    }

    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.id))
      .collect();

    for (const sp of scheduledPayments) {
      const allocations = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp._id)
        )
        .collect();
      for (const alloc of allocations) {
        await ctx.db.delete(alloc._id);
      }
      await ctx.db.delete(sp._id);
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.id))
      .collect();

    for (const payment of payments) {
      const allocations = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q) =>
          q.eq("paymentId", payment._id)
        )
        .collect();
      for (const alloc of allocations) {
        await ctx.db.delete(alloc._id);
      }
      await ctx.db.delete(payment._id);
    }

    await ctx.db.patch(args.id, { isDeleted: true });

    await invalidateStatsCache(
      ctx,
      purchase.orgId,
      purchase.calendarEditionIds,
      purchase.year
    );
  },
});

export const regenerateSchedule = mutation({
  args: {
    purchaseId: v.id("purchases"),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.orgId !== args.orgId) {
      throw new Error("Purchase not found");
    }

    const terms = await ctx.db
      .query("paymentTerms")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", args.purchaseId)
      )
      .first();
    if (!terms) {
      throw new Error("No payment terms found for this purchase");
    }

    const oldScheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", args.purchaseId)
      )
      .collect();

    for (const sp of oldScheduledPayments) {
      const allocations = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp._id)
        )
        .collect();
      for (const alloc of allocations) {
        await ctx.db.delete(alloc._id);
      }
      await ctx.db.delete(sp._id);
    }

    const scheduleBase = computeScheduleBase(terms);
    const scheduledPaymentInputs = generateScheduledPayments({
      baseNet: scheduleBase,
      dueDayOfMonth: terms.dueDayOfMonth ?? 1,
      splitEqually: terms.splitEqually ?? true,
      startMonth: terms.scheduleStartMonth ?? 1,
      startYear: terms.scheduleStartYear ?? purchase.year,
      endMonth: terms.scheduleEndMonth ?? 12,
      endYear: terms.scheduleEndYear ?? purchase.year,
      customSchedule: terms.customSchedule,
    });

    for (const sp of scheduledPaymentInputs) {
      await ctx.db.insert("scheduledPayments", {
        purchaseId: args.purchaseId,
        dueDate: sp.dueDate,
        amount: sp.amount,
        month: sp.month,
        year: sp.year,
        orgId: purchase.orgId,
      });
    }

    return {
      deletedCount: oldScheduledPayments.length,
      createdCount: scheduledPaymentInputs.length,
      scheduleBase,
    };
  },
});