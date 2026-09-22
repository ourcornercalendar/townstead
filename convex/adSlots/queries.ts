import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireOrg, isOwnDoc } from "../auth.helpers";

export const getSlotAvailability = query({
  args: {
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
    month: v.number(),
    advertisementId: v.id("advertisements"),
    orgId: v.string(),
    excludePurchaseId: v.optional(v.id("purchases")),
    isDayType: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    type OccupantInfo = {
      adPurchaseId: string;
      contactId: string;
      contactName: string;
      company: string;
    };

    const slots = await ctx.db
      .query("adSlots")
      .withIndex("by_calendarEdition_year_month_advertisement", (q) =>
        q
          .eq("calendarEditionId", args.calendarEditionId)
          .eq("year", args.year)
          .eq("month", args.month)
          .eq("advertisementId", args.advertisementId)
      )
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    let filtered = slots;
    if (args.excludePurchaseId) {
      const excludeAdPurchaseIds = new Set<string>();
      const adPurchases = await ctx.db
        .query("adPurchases")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", args.excludePurchaseId!)
        )
        .collect();
      for (const ap of adPurchases) {
        excludeAdPurchaseIds.add(ap._id);
      }
      filtered = slots.filter(
        (s) => !excludeAdPurchaseIds.has(s.adPurchaseId)
      );
    }

    const contactCache = new Map<string, { name: string; company: string }>();
    const purchaseCache = new Map<string, Id<"contacts">>(); // adPurchaseId -> contactId
    const adPurchaseCache = new Map<string, Id<"purchases">>(); // adPurchaseId -> purchaseId

    const takenSlots: Record<number, OccupantInfo[]> = {};
    for (const slot of filtered) {
      if (slot.slotNumber == null) continue;

      let contactId: Id<"contacts"> | undefined;

      if (purchaseCache.has(slot.adPurchaseId)) {
        contactId = purchaseCache.get(slot.adPurchaseId);
      } else {
        let purchaseId = adPurchaseCache.get(slot.adPurchaseId);
        if (!purchaseId) {
          const adPurchase = await ctx.db.get(slot.adPurchaseId);
          if (adPurchase) {
            purchaseId = adPurchase.purchaseId;
            adPurchaseCache.set(slot.adPurchaseId, purchaseId);
          }
        }
        if (purchaseId) {
          const purchase = await ctx.db.get(purchaseId);
          if (purchase) {
            contactId = purchase.contactId;
            purchaseCache.set(slot.adPurchaseId, contactId);
          }
        }
      }

      let contactInfo = { name: "", company: "" };
      if (contactId) {
        if (contactCache.has(contactId)) {
          contactInfo = contactCache.get(contactId)!;
        } else {
          const contact = await ctx.db.get(contactId);
          if (contact) {
            contactInfo = {
              name: `${contact.firstName} ${contact.lastName}`,
              company: contact.company ?? "",
            };
            contactCache.set(contactId, contactInfo);
          }
        }
      }

      const occupant: OccupantInfo = {
        adPurchaseId: slot.adPurchaseId,
        contactId: contactId ?? "",
        contactName: contactInfo.name,
        company: contactInfo.company,
      };

      if (!takenSlots[slot.slotNumber]) {
        takenSlots[slot.slotNumber] = [];
      }
      takenSlots[slot.slotNumber].push(occupant);
    }

    return { takenSlots, totalTaken: filtered.length };
  },
});

export const listByAdPurchase = query({
  args: { adPurchaseId: v.id("adPurchases") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.adPurchaseId)))) return [];
    return await ctx.db
      .query("adSlots")
      .withIndex("by_adPurchaseId", (q) =>
        q.eq("adPurchaseId", args.adPurchaseId)
      )
      .collect();
  },
});
