import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("purchases.queries.getByContactAndYear", () => {
  it("returns purchase summary when match exists", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Acme Corp",
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
        slotsPerMonth: 1,
        orgId: "org_1",
      });
      return { contactId: cId, editionId: eId, adId: aId };
    });

    await t.mutation(api.purchases.mutations.create, {
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
        totalSale: 120000,
        dueDayOfMonth: 1,
        splitEqually: true,
      },
    });

    const result = await t.query(api.purchases.queries.getByContactAndYear, {
      contactId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result).not.toBeNull();
    expect(result!._id).toBeTruthy();
    expect(result!.editionCode).toBe("SP26");
    expect(result!.net).toBe(120000);
    expect(result!.amountPaid).toBe(0);
    expect(result!.isPaid).toBe(false);
  });

  it("returns null when no purchase exists for contact+year", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const contactId = await t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        company: "Empty Corp",
        firstName: "No",
        lastName: "Purchase",
        orgId: "org_1",
      });
    });

    const result = await t.query(api.purchases.queries.getByContactAndYear, {
      contactId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result).toBeNull();
  });

  it("returns null when purchase exists for different year", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Year Corp",
        firstName: "Y",
        lastName: "Test",
        orgId: "org_1",
      });
      const eId = await ctx.db.insert("calendarEditions", {
        name: "Ed",
        code: "ED",
        orgId: "org_1",
      });
      const aId = await ctx.db.insert("advertisements", {
        name: "Ad",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
      });
      return { contactId: cId, editionId: eId, adId: aId };
    });

    await t.mutation(api.purchases.mutations.create, {
      orgId: "org_1",
      contactId,
      calendarEditionIds: [editionId],
      year: 2025,
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

    const result = await t.query(api.purchases.queries.getByContactAndYear, {
      contactId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result).toBeNull();
  });

  it("excludes soft-deleted purchases", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Deleted Corp",
        firstName: "D",
        lastName: "Test",
        orgId: "org_1",
      });
      const eId = await ctx.db.insert("calendarEditions", {
        name: "Ed",
        code: "ED",
        orgId: "org_1",
      });
      const aId = await ctx.db.insert("advertisements", {
        name: "Ad",
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
        totalSale: 80000,
        dueDayOfMonth: 1,
        splitEqually: true,
      },
    });

    await t.mutation(api.purchases.mutations.softDelete, { id: purchaseId });

    const result = await t.query(api.purchases.queries.getByContactAndYear, {
      contactId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result).toBeNull();
  });

  it("computes amountPaid correctly when payments exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { contactId, editionId, adId } = await t.run(async (ctx) => {
      const cId = await ctx.db.insert("contacts", {
        company: "Paying Corp",
        firstName: "P",
        lastName: "Test",
        orgId: "org_1",
      });
      const eId = await ctx.db.insert("calendarEditions", {
        name: "Ed",
        code: "ED",
        orgId: "org_1",
      });
      const aId = await ctx.db.insert("advertisements", {
        name: "Ad",
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
        totalSale: 120000,
        dueDayOfMonth: 1,
        splitEqually: true,
        scheduleStartMonth: 1,
        scheduleStartYear: 2026,
        scheduleEndMonth: 12,
        scheduleEndYear: 2026,
      },
    });

    await t.run(async (ctx) => {
      const sp = await ctx.db
        .query("scheduledPayments")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchaseId))
        .first();

      const paymentId = await ctx.db.insert("payments", {
        purchaseId,
        amount: 30000,
        date: 1710000000000,
        method: "check",
        orgId: "org_1",
      });

      if (sp) {
        await ctx.db.insert("paymentAllocations", {
          paymentId,
          scheduledPaymentId: sp._id,
          amount: 30000,
          orgId: "org_1",
        });
      }
    });

    const result = await t.query(api.purchases.queries.getByContactAndYear, {
      contactId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result).not.toBeNull();
    expect(result!.net).toBe(120000);
    expect(result!.amountPaid).toBe(30000);
    expect(result!.isPaid).toBe(false);
  });
});
