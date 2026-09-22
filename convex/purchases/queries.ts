import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import {
  computeNet,
  computeAmountPaid,
  computeAmountPaidWithPrepaid,
  computeIsPaid,
  computeLateFees,
  isScheduledPaymentLate,
  computeScheduledPaymentPaid,
} from "../billing/helpers";
import { requireOrg, isOwnDoc } from "../auth.helpers";

async function getEditionCodesSorted(ctx: { db: any }, editionIds: any[]) {
  const editions = [];
  for (const id of editionIds) {
    const edition = await ctx.db.get(id);
    if (edition) editions.push(edition);
  }
  editions.sort((a: any, b: any) => a.code.localeCompare(b.code));
  return editions.map((e: any) => e.code as string);
}

async function getEditionNames(ctx: { db: any }, editionIds: any[]) {
  const editions = [];
  for (const id of editionIds) {
    const edition = await ctx.db.get(id);
    if (edition) editions.push(edition);
  }
  editions.sort((a: any, b: any) => a.name.localeCompare(b.name));
  return editions.map((e: any) => e.name as string);
}

export const list = query({
  args: { orgId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const enriched = await Promise.all(
      purchases.map(async (purchase) => {
        const contact = await ctx.db.get(purchase.contactId);

        const editionCodes = await getEditionCodesSorted(
          ctx,
          purchase.calendarEditionIds
        );

        const terms = await ctx.db
          .query("paymentTerms")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .first();

        const scheduledPayments = await ctx.db
          .query("scheduledPayments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const allAllocations: Doc<"paymentAllocations">[] = [];
        for (const sp of scheduledPayments) {
          const spAllocations = await ctx.db
            .query("paymentAllocations")
            .withIndex("by_scheduledPaymentId", (q) =>
              q.eq("scheduledPaymentId", sp._id)
            )
            .collect();
          allAllocations.push(...spAllocations);
        }

        const purchasePayments = await ctx.db
          .query("payments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const net = terms
          ? computeNet(terms, scheduledPayments, allAllocations, args.now)
          : 0;
        const { amountPaid } = computeAmountPaidWithPrepaid(
          allAllocations,
          purchasePayments
        );
        const isPaid = computeIsPaid(net, amountPaid);
        const hasLate = scheduledPayments.some((sp) =>
          isScheduledPaymentLate(sp, allAllocations, args.now)
        );

        return {
          ...purchase,
          contactName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unknown",
          company: contact?.company ?? "",
          editionCode: editionCodes.join(", ") || "Unknown",
          net,
          amountPaid,
          isPaid,
          hasLate,
        };
      })
    );

    return enriched;
  },
});

export const getById = query({
  args: { id: v.id("purchases") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    return await ctx.db.get(args.id);
  },
});

export const getDetail = query({
  args: { id: v.id("purchases"), now: v.number() },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    const purchase = await ctx.db.get(args.id);
    if (!purchase || purchase.isDeleted) return null;

    const contact = await ctx.db.get(purchase.contactId);

    const editions = [];
    for (const eid of purchase.calendarEditionIds) {
      const ed = await ctx.db.get(eid);
      if (ed) editions.push(ed);
    }

    const terms = await ctx.db
      .query("paymentTerms")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .first();

    const adPurchases = await ctx.db
      .query("adPurchases")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const adPurchasesWithDetails = await Promise.all(
      adPurchases.map(async (ap) => {
        const ad = await ctx.db.get(ap.advertisementId);
        const edition = ap.calendarEditionId
          ? await ctx.db.get(ap.calendarEditionId)
          : null;
        const slots = await ctx.db
          .query("adSlots")
          .withIndex("by_adPurchaseId", (q) =>
            q.eq("adPurchaseId", ap._id)
          )
          .collect();
        return {
          ...ap,
          advertisementName: ad?.name ?? "Unknown",
          isDayType: ad?.isDayType ?? false,
          slotsPerMonth: ad?.slotsPerMonth ?? 0,
          editionName: edition?.name ?? "Unknown",
          slots,
        };
      })
    );

    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const allAllocations: Doc<"paymentAllocations">[] = [];
    for (const sp of scheduledPayments) {
      const spAllocs = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp._id)
        )
        .collect();
      allAllocations.push(...spAllocs);
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const paymentsWithAllocations = await Promise.all(
      payments.map(async (payment) => {
        const paymentAllocs = await ctx.db
          .query("paymentAllocations")
          .withIndex("by_paymentId", (q) =>
            q.eq("paymentId", payment._id)
          )
          .collect();
        return { ...payment, allocations: paymentAllocs };
      })
    );

    const net = terms
      ? computeNet(terms, scheduledPayments, allAllocations, args.now)
      : 0;
    const { amountPaid } = computeAmountPaidWithPrepaid(
      allAllocations,
      payments
    );
    const isPaid = computeIsPaid(net, amountPaid);
    const lateFees = terms
      ? computeLateFees(terms, scheduledPayments, allAllocations, args.now)
      : 0;

    const enrichedScheduledPayments = scheduledPayments
      .sort((a, b) => a.dueDate - b.dueDate)
      .map((sp) => ({
        ...sp,
        paidAmount: computeScheduledPaymentPaid(sp._id, allAllocations),
        isLate: isScheduledPaymentLate(sp, allAllocations, args.now),
      }));

    return {
      ...purchase,
      contact,
      editions,
      terms,
      adPurchases: adPurchasesWithDetails,
      scheduledPayments: enrichedScheduledPayments,
      payments: paymentsWithAllocations,
      net,
      amountPaid,
      isPaid,
      lateFees,
    };
  },
});

export const getByContactAndYear = query({
  args: { contactId: v.id("contacts"), year: v.number(), now: v.number() },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.contactId)))) return null;
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_contactId", (q) => q.eq("contactId", args.contactId))
      .filter((q) =>
        q.and(
          q.eq(q.field("year"), args.year),
          q.neq(q.field("isDeleted"), true)
        )
      )
      .first();

    if (!purchase) return null;

    const editionCodes = await getEditionCodesSorted(
      ctx,
      purchase.calendarEditionIds
    );

    const terms = await ctx.db
      .query("paymentTerms")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .first();

    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const allAllocations: Doc<"paymentAllocations">[] = [];
    for (const sp of scheduledPayments) {
      const spAllocs = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp._id)
        )
        .collect();
      allAllocations.push(...spAllocs);
    }

    const purchasePayments = await ctx.db
      .query("payments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const net = terms
      ? computeNet(terms, scheduledPayments, allAllocations, args.now)
      : 0;
    const { amountPaid } = computeAmountPaidWithPrepaid(
      allAllocations,
      purchasePayments
    );
    const isPaid = computeIsPaid(net, amountPaid);

    return {
      _id: purchase._id,
      editionCode: editionCodes.join(", ") || "Unknown",
      net,
      amountPaid,
      isPaid,
    };
  },
});

export const exportContacts = query({
  args: { orgId: v.string(), year: v.number() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_orgId_and_year", (q) =>
        q.eq("orgId", args.orgId).eq("year", args.year)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const seen = new Set<string>();
    const contacts: Doc<"contacts">[] = [];
    for (const purchase of purchases) {
      const key = String(purchase.contactId);
      if (seen.has(key)) continue;
      seen.add(key);
      const contact = await ctx.db.get(purchase.contactId);
      if (contact && !contact.isDeleted) contacts.push(contact);
    }

    contacts.sort((a, b) => a.company.localeCompare(b.company));
    return contacts;
  },
});

export const listByContact = query({
  args: { contactId: v.id("contacts"), now: v.number() },
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

    const enriched = await Promise.all(
      purchases.map(async (purchase) => {
        const editionCodes = await getEditionCodesSorted(
          ctx,
          purchase.calendarEditionIds
        );

        const terms = await ctx.db
          .query("paymentTerms")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .first();

        const scheduledPayments = await ctx.db
          .query("scheduledPayments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const allAllocations = [];
        for (const sp of scheduledPayments) {
          const spAllocs = await ctx.db
            .query("paymentAllocations")
            .withIndex("by_scheduledPaymentId", (q) =>
              q.eq("scheduledPaymentId", sp._id)
            )
            .collect();
          allAllocations.push(...spAllocs);
        }

        const purchasePayments = await ctx.db
          .query("payments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const net = terms
          ? computeNet(terms, scheduledPayments, allAllocations, args.now)
          : 0;
        const { amountPaid } = computeAmountPaidWithPrepaid(
          allAllocations,
          purchasePayments
        );
        const isPaid = computeIsPaid(net, amountPaid);

        return {
          ...purchase,
          editionCode: editionCodes.join(", ") || "Unknown",
          net,
          amountPaid,
          isPaid,
        };
      })
    );

    return enriched;
  },
});
