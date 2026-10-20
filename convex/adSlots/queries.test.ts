import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("adSlots.queries.listByAdPurchase", () => {
  it("returns slots for an ad purchase", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adPurchaseId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
        isDeleted: false,
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Full Page",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
        isDeleted: false,
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      const apId = await ctx.db.insert("adPurchases", {
        purchaseId,
        advertisementId: adId,
        calendarEditionId: editionId,
        quantity: 3,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: apId,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 1,
        slotNumber: 1,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: apId,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 2,
        slotNumber: 1,
        orgId: "org_1",
      });
      return apId;
    });

    const results = await t.query(api.adSlots.queries.listByAdPurchase, {
      adPurchaseId,
    });
    expect(results).toHaveLength(2);
    expect(results[0].month).toBe(1);
    expect(results[1].month).toBe(2);
  });

  it("returns empty when no slots exist for ad purchase", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adPurchaseId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Empty Co",
        firstName: "No",
        lastName: "Slots",
        orgId: "org_1",
        isDeleted: false,
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Fall 2026",
        code: "FA26",
        orgId: "org_1",
        isDeleted: false,
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Banner",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
        isDeleted: false,
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      return await ctx.db.insert("adPurchases", {
        purchaseId,
        advertisementId: adId,
        calendarEditionId: editionId,
        quantity: 0,
        orgId: "org_1",
      });
    });

    const results = await t.query(api.adSlots.queries.listByAdPurchase, {
      adPurchaseId,
    });
    expect(results).toHaveLength(0);
  });
});

describe("adSlots.queries.getSlotAvailability", () => {
  it("returns taken slots with occupant info", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId } = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Advertiser Inc",
        firstName: "John",
        lastName: "Smith",
        orgId: "org_1",
        isDeleted: false,
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
        isDeleted: false,
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Full Page",
        isDayType: false,
        slotsPerMonth: 4,
        orgId: "org_1",
        isDeleted: false,
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      const apId = await ctx.db.insert("adPurchases", {
        purchaseId,
        advertisementId: adId,
        calendarEditionId: editionId,
        quantity: 2,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: apId,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 3,
        slotNumber: 1,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: apId,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 3,
        slotNumber: 2,
        orgId: "org_1",
      });
      return { adId, editionId };
    });

    const result = await t.query(api.adSlots.queries.getSlotAvailability, {
      calendarEditionId: editionId,
      year: 2026,
      month: 3,
      advertisementId: adId,
      orgId: "org_1",
    });

    expect(result.totalTaken).toBe(2);
    expect(result.takenSlots[1]).toHaveLength(1);
    expect(result.takenSlots[1][0].contactName).toBe("John Smith");
    expect(result.takenSlots[1][0].company).toBe("Advertiser Inc");
    expect(result.takenSlots[2]).toHaveLength(1);
  });

  it("returns empty takenSlots when no slots are occupied", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId } = await t.run(async (ctx) => {
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Empty Ed",
        code: "EE",
        orgId: "org_1",
        isDeleted: false,
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Banner",
        isDayType: false,
        slotsPerMonth: 4,
        orgId: "org_1",
        isDeleted: false,
      });
      return { adId, editionId };
    });

    const result = await t.query(api.adSlots.queries.getSlotAvailability, {
      calendarEditionId: editionId,
      year: 2026,
      month: 6,
      advertisementId: adId,
      orgId: "org_1",
    });

    expect(result.totalTaken).toBe(0);
    expect(Object.keys(result.takenSlots)).toHaveLength(0);
  });

  it("excludes slots from excludePurchaseId", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId, excludePurchaseId } = await t.run(async (ctx) => {
      const contact1 = await ctx.db.insert("contacts", {
        company: "Company A",
        firstName: "Alice",
        lastName: "A",
        orgId: "org_1",
        isDeleted: false,
      });
      const contact2 = await ctx.db.insert("contacts", {
        company: "Company B",
        firstName: "Bob",
        lastName: "B",
        orgId: "org_1",
        isDeleted: false,
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Ed",
        code: "ED",
        orgId: "org_1",
        isDeleted: false,
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Ad",
        isDayType: false,
        slotsPerMonth: 4,
        orgId: "org_1",
        isDeleted: false,
      });

      const purchase1 = await ctx.db.insert("purchases", {
        contactId: contact1,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      const purchase2 = await ctx.db.insert("purchases", {
        contactId: contact2,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });

      const ap1 = await ctx.db.insert("adPurchases", {
        purchaseId: purchase1,
        advertisementId: adId,
        calendarEditionId: editionId,
        quantity: 1,
        orgId: "org_1",
      });
      const ap2 = await ctx.db.insert("adPurchases", {
        purchaseId: purchase2,
        advertisementId: adId,
        calendarEditionId: editionId,
        quantity: 1,
        orgId: "org_1",
      });

      await ctx.db.insert("adSlots", {
        adPurchaseId: ap1,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 1,
        slotNumber: 1,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: ap2,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 1,
        slotNumber: 2,
        orgId: "org_1",
      });

      return { adId, editionId, excludePurchaseId: purchase1 };
    });

    const result = await t.query(api.adSlots.queries.getSlotAvailability, {
      calendarEditionId: editionId,
      year: 2026,
      month: 1,
      advertisementId: adId,
      orgId: "org_1",
      excludePurchaseId,
    });

    expect(result.totalTaken).toBe(1);
    expect(result.takenSlots[2]).toHaveLength(1);
    expect(result.takenSlots[2][0].contactName).toBe("Bob B");
    expect(result.takenSlots[1]).toBeUndefined();
  });

  it("skips slots without slotNumber from takenSlots map", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId } = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Co",
        firstName: "X",
        lastName: "Y",
        orgId: "org_1",
        isDeleted: false,
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Ed",
        code: "E",
        orgId: "org_1",
        isDeleted: false,
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Ad",
        isDayType: false,
        slotsPerMonth: 2,
        orgId: "org_1",
        isDeleted: false,
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      const apId = await ctx.db.insert("adPurchases", {
        purchaseId,
        advertisementId: adId,
        calendarEditionId: editionId,
        quantity: 1,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: apId,
        advertisementId: adId,
        calendarEditionId: editionId,
        year: 2026,
        month: 5,
        orgId: "org_1",
      });
      return { adId, editionId };
    });

    const result = await t.query(api.adSlots.queries.getSlotAvailability, {
      calendarEditionId: editionId,
      year: 2026,
      month: 5,
      advertisementId: adId,
      orgId: "org_1",
    });

    expect(result.totalTaken).toBe(1);
    expect(Object.keys(result.takenSlots)).toHaveLength(0);
  });
});
