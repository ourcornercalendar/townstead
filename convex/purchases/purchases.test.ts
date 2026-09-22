import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("purchases", () => {
  it("tenant isolation — list returns only purchases for the given org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      const contactA = await ctx.db.insert("contacts", {
        company: "A Corp",
        firstName: "A",
        lastName: "One",
        orgId: "org_a",
      });
      const contactB = await ctx.db.insert("contacts", {
        company: "B Corp",
        firstName: "B",
        lastName: "Two",
        orgId: "org_b",
      });
      const edA = await ctx.db.insert("calendarEditions", {
        name: "Ed A",
        code: "EA",
        orgId: "org_a",
      });
      const edB = await ctx.db.insert("calendarEditions", {
        name: "Ed B",
        code: "EB",
        orgId: "org_b",
      });
      await ctx.db.insert("purchases", {
        contactId: contactA,
        calendarEditionIds: [edA],
        year: 2026,
        orgId: "org_a",
        isDeleted: false,
      });
      await ctx.db.insert("purchases", {
        contactId: contactB,
        calendarEditionIds: [edB],
        year: 2026,
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await t.query(api.purchases.queries.list, {
      orgId: "org_a",
      now: 1710000000000,
    });
    expect(results).toHaveLength(1);
    expect(results[0].company).toBe("A Corp");
  });

  it("soft-deleted purchases are excluded from list", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Test",
        firstName: "T",
        lastName: "T",
        orgId: "org_1",
      });
      const edId = await ctx.db.insert("calendarEditions", {
        name: "Ed",
        code: "ED",
        orgId: "org_1",
      });
      await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [edId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [edId],
        year: 2026,
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await t.query(api.purchases.queries.list, {
      orgId: "org_1",
      now: 1710000000000,
    });
    expect(results).toHaveLength(1);
  });

  it("create returns an ID and generates invoice number", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Buyer Corp",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
      });
      const eId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
      });
      const aId = await ctx.db.insert("advertisements", {
        name: "Banner",
        isDayType: false,
        slotsPerMonth: 2,
        orgId: "org_1",
      });
      return { contactId: cId, editionId: eId, adId: aId };
    });

    const purchaseId = await t.mutation(api.purchases.mutations.create, {
      orgId: "org_1",
      contactId,
      calendarEditionIds: [editionId],
      year: 2026,
      adSelections: [
        {
          advertisementId: adId,
          calendarEditionId: editionId,
          quantity: 1,
          slots: [{ month: 1, slotNumber: 1 }],
        },
      ],
      paymentTerms: {
        totalSale: 120000,
        dueDayOfMonth: 1,
        splitEqually: true,
      },
    });
    expect(purchaseId).toBeTruthy();

    const purchase = await t.query(api.purchases.queries.getById, {
      id: purchaseId,
    });
    expect(purchase).not.toBeNull();
    expect(purchase!.invoiceNumber).toMatch(/^26\d{4}$/);
    expect(purchase!.year).toBe(2026);

    const scheduledPayments = await t.run(async (ctx) => {
      return await ctx.db
        .query("scheduledPayments")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchaseId))
        .collect();
    });
    expect(scheduledPayments.length).toBeGreaterThan(0);
    const totalScheduled = scheduledPayments.reduce(
      (sum, sp) => sum + sp.amount,
      0
    );
    expect(totalScheduled).toBe(120000);
  });

  it("getDetail returns enriched purchase with computed billing fields", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Detail Corp",
        firstName: "Bob",
        lastName: "Smith",
        orgId: "org_1",
      });
      const eId = await ctx.db.insert("calendarEditions", {
        name: "Fall 2026",
        code: "FA26",
        orgId: "org_1",
      });
      const aId = await ctx.db.insert("advertisements", {
        name: "Sidebar",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
      });
      return { contactId: cId, editionId: eId, adId: aId };
    });

    const purchaseId = await t.mutation(api.purchases.mutations.create, {
      orgId: "org_1",
      contactId,
      calendarEditionIds: [editionId],
      year: 2026,
      adSelections: [
        {
          advertisementId: adId,
          calendarEditionId: editionId,
          quantity: 1,
          slots: [{ month: 6 }],
        },
      ],
      paymentTerms: {
        totalSale: 60000,
        discount1: 5000,
        dueDayOfMonth: 15,
        splitEqually: true,
      },
    });

    const detail = await t.query(api.purchases.queries.getDetail, {
      id: purchaseId,
      now: 1710000000000,
    });
    expect(detail).not.toBeNull();
    expect(detail!.contact!.company).toBe("Detail Corp");
    expect(detail!.net).toBe(55000);
    expect(detail!.amountPaid).toBe(0);
    expect(detail!.isPaid).toBe(false);
    expect(detail!.adPurchases).toHaveLength(1);
  });

  it("softDelete marks purchase as deleted and cleans up related records", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Delete Corp",
        firstName: "Del",
        lastName: "Eted",
        orgId: "org_1",
      });
      const eId = await ctx.db.insert("calendarEditions", {
        name: "Winter 2026",
        code: "WI26",
        orgId: "org_1",
      });
      const aId = await ctx.db.insert("advertisements", {
        name: "Footer",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
      });
      return { contactId: cId, editionId: eId, adId: aId };
    });

    const purchaseId = await t.mutation(api.purchases.mutations.create, {
      orgId: "org_1",
      contactId,
      calendarEditionIds: [editionId],
      year: 2026,
      adSelections: [
        {
          advertisementId: adId,
          calendarEditionId: editionId,
          quantity: 1,
          slots: [{ month: 1 }],
        },
      ],
      paymentTerms: {
        totalSale: 50000,
        dueDayOfMonth: 1,
        splitEqually: true,
      },
    });

    await t.mutation(api.purchases.mutations.softDelete, { id: purchaseId });

    const deleted = await t.query(api.purchases.queries.getById, {
      id: purchaseId,
    });
    expect(deleted!.isDeleted).toBe(true);

    const remainingSlots = await t.run(async (ctx) => {
      const adPurchases = await ctx.db
        .query("adPurchases")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchaseId))
        .collect();
      return adPurchases;
    });
    expect(remainingSlots).toHaveLength(0);

    const remainingSp = await t.run(async (ctx) => {
      return await ctx.db
        .query("scheduledPayments")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchaseId))
        .collect();
    });
    expect(remainingSp).toHaveLength(0);
  });
});
