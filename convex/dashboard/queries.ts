import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  computeNet,
  computeAmountPaid,
  isScheduledPaymentLate,
} from "../billing/helpers";
import { requireOrg } from "../auth.helpers";

async function enrichSlotsForEdition(
  ctx: QueryCtx,
  calendarEditionId: Id<"calendarEditions">,
  year: number,
  advertisementIdFilter: Set<string> | null
): Promise<
  Array<{
    _id: Id<"adSlots">;
    month: number;
    slotNumber: number | null;
    contactId: Id<"contacts">;
    contactName: string;
    company: string;
    advertisementName: string;
    advertisementId: Id<"advertisements">;
    isDayType: boolean;
    purchaseId: Id<"purchases">;
  }>
> {
  const adSlots = await ctx.db
    .query("adSlots")
    .withIndex("by_calendarEdition_year_month", (q) =>
      q.eq("calendarEditionId", calendarEditionId).eq("year", year)
    )
    .collect();

  const adPurchaseCache = new Map<string, Doc<"adPurchases"> | null>();
  const purchaseCache = new Map<string, Doc<"purchases"> | null>();
  const contactCache = new Map<string, Doc<"contacts"> | null>();
  const adCache = new Map<string, Doc<"advertisements"> | null>();

  async function cached<T>(
    cache: Map<string, T | null>,
    id: { toString(): string },
    fetcher: () => Promise<T | null>
  ): Promise<T | null> {
    const key = id.toString();
    if (!cache.has(key)) {
      cache.set(key, await fetcher());
    }
    return cache.get(key) ?? null;
  }

  const enrichedSlots = [];
  for (const slot of adSlots) {
    const adPurchase = await cached(adPurchaseCache, slot.adPurchaseId, () =>
      ctx.db.get(slot.adPurchaseId)
    );
    if (!adPurchase) continue;

    if (
      advertisementIdFilter !== null &&
      !advertisementIdFilter.has(adPurchase.advertisementId.toString())
    ) {
      continue;
    }

    const purchase = await cached(
      purchaseCache,
      adPurchase.purchaseId,
      () => ctx.db.get(adPurchase.purchaseId)
    );
    if (!purchase || purchase.isDeleted) continue;

    const contact = await cached(contactCache, purchase.contactId, () =>
      ctx.db.get(purchase.contactId)
    );

    const ad = await cached(adCache, adPurchase.advertisementId, () =>
      ctx.db.get(adPurchase.advertisementId)
    );

    enrichedSlots.push({
      _id: slot._id,
      month: slot.month,
      slotNumber: slot.slotNumber ?? null,
      contactId: purchase.contactId,
      contactName: contact
        ? `${contact.firstName} ${contact.lastName}`
        : "Unknown",
      company: contact?.company ?? "",
      advertisementName: ad?.name ?? "Unknown",
      advertisementId: adPurchase.advertisementId,
      isDayType: ad?.isDayType ?? false,
      purchaseId: adPurchase.purchaseId,
    });
  }

  return enrichedSlots;
}

export const getPrintInventoryData = query({
  args: {
    orgId: v.string(),
    year: v.number(),
    calendarEditionIds: v.array(v.id("calendarEditions")),
    advertisementIds: v.optional(v.array(v.id("advertisements"))),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const advertisementIdFilter =
      args.advertisementIds === undefined
        ? null
        : new Set(args.advertisementIds.map((id) => id.toString()));

    const editions = [];
    for (const calendarEditionId of args.calendarEditionIds) {
      const edition = await ctx.db.get(calendarEditionId);
      if (!edition || edition.isDeleted || edition.orgId !== args.orgId) {
        continue;
      }

      const slots = await enrichSlotsForEdition(
        ctx,
        calendarEditionId,
        args.year,
        advertisementIdFilter
      );

      editions.push({
        editionId: calendarEditionId,
        editionName: edition.name,
        slots,
      });
    }

    const contactMap = new Map<string, { id: string; company: string }>();
    for (const e of editions) {
      for (const slot of e.slots) {
        const cid = slot.contactId.toString();
        if (!contactMap.has(cid)) {
          contactMap.set(cid, {
            id: cid,
            company: slot.company || slot.contactName,
          });
        }
      }
    }

    return {
      editions,
      contacts: Array.from(contactMap.values()),
    };
  },
});

export const getDashboardSlots = query({
  args: {
    orgId: v.string(),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const enrichedSlots = await enrichSlotsForEdition(
      ctx,
      args.calendarEditionId,
      args.year,
      null
    );

    const contactMap = new Map<string, { id: string; company: string }>();
    for (const slot of enrichedSlots) {
      const cid = slot.contactId.toString();
      if (!contactMap.has(cid)) {
        contactMap.set(cid, {
          id: cid,
          company: slot.company || slot.contactName,
        });
      }
    }

    return {
      slots: enrichedSlots,
      contacts: Array.from(contactMap.values()),
    };
  },
});

export const getDashboardStats = query({
  args: {
    orgId: v.string(),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const cached = await ctx.db
      .query("dashboardStatsCache")
      .withIndex("by_org_edition_year", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("calendarEditionId", args.calendarEditionId)
          .eq("year", args.year)
      )
      .first();

    if (cached) {
      const collectionRate =
        cached.totalRevenue > 0
          ? Math.round(
              (cached.totalAmountPaid / cached.totalRevenue) * 10000
            ) / 100
          : 0;
      return {
        totalRevenue: cached.totalRevenue,
        collectionRate,
        outstandingBalance: Math.max(
          0,
          cached.totalRevenue - cached.totalAmountPaid
        ),
        latePaymentsCount: cached.latePaymentsCount,
      };
    }

    return computeDashboardStatsFromDb(
      ctx,
      args.orgId,
      args.calendarEditionId,
      args.year,
      args.now
    );
  },
});

export async function computeDashboardStatsFromDb(
  ctx: QueryCtx,
  orgId: string,
  calendarEditionId: Id<"calendarEditions">,
  year: number,
  now: number
) {
  const allPurchases = await ctx.db
    .query("purchases")
    .withIndex("by_orgId_and_year", (q) =>
      q.eq("orgId", orgId).eq("year", year)
    )
    .filter((q) => q.neq(q.field("isDeleted"), true))
    .collect();

  const editionPurchases = allPurchases.filter((p) =>
    p.calendarEditionIds.includes(calendarEditionId)
  );

  let totalRevenue = 0;
  let totalAmountPaid = 0;
  let latePaymentsCount = 0;

  for (const purchase of editionPurchases) {
    const terms = await ctx.db
      .query("paymentTerms")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", purchase._id)
      )
      .first();

    if (!terms) continue;

    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", purchase._id)
      )
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

    const net = computeNet(terms, scheduledPayments, allAllocations, now);
    const amountPaid = computeAmountPaid(allAllocations);

    totalRevenue += net;
    totalAmountPaid += amountPaid;

    for (const sp of scheduledPayments) {
      if (isScheduledPaymentLate(sp, allAllocations, now)) {
        latePaymentsCount++;
      }
    }
  }

  const collectionRate =
    totalRevenue > 0
      ? Math.round((totalAmountPaid / totalRevenue) * 10000) / 100
      : 0;

  return {
    totalRevenue,
    collectionRate,
    outstandingBalance: Math.max(0, totalRevenue - totalAmountPaid),
    latePaymentsCount,
  };
}
