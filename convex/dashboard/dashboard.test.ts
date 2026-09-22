import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("dashboard", () => {
  it("tenant isolation — getPrintInventoryData excludes other org editions", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    const editionId = await t.run(async (ctx) => {
      return await ctx.db.insert("calendarEditions", {
        name: "Org B Edition",
        code: "OB26",
        orgId: "org_b",
      });
    });

    const result = await t.query(
      api.dashboard.queries.getPrintInventoryData,
      {
        orgId: "org_a",
        year: 2026,
        calendarEditionIds: [editionId],
      }
    );
    expect(result.editions).toHaveLength(0);
    expect(result.contacts).toHaveLength(0);
  });

  it("getDashboardSlots returns empty slots for an edition with no purchases", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) => {
      return await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
      });
    });

    const result = await t.query(api.dashboard.queries.getDashboardSlots, {
      orgId: "org_1",
      calendarEditionId: editionId,
      year: 2026,
    });

    expect(result.slots).toHaveLength(0);
    expect(result.contacts).toHaveLength(0);
  });

  it("getDashboardStats returns zero stats for an edition with no purchases", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) => {
      return await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
      });
    });

    const result = await t.query(api.dashboard.queries.getDashboardStats, {
      orgId: "org_1",
      calendarEditionId: editionId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result.totalRevenue).toBe(0);
    expect(result.collectionRate).toBe(0);
    expect(result.outstandingBalance).toBe(0);
    expect(result.latePaymentsCount).toBe(0);
  });

  it("getDashboardStats reads from cache when available", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) => {
      const eid = await ctx.db.insert("calendarEditions", {
        name: "Cached Edition",
        code: "CE26",
        orgId: "org_1",
      });
      await ctx.db.insert("dashboardStatsCache", {
        orgId: "org_1",
        calendarEditionId: eid,
        year: 2026,
        totalRevenue: 5000000,
        totalAmountPaid: 4500000,
        latePaymentsCount: 1,
        computedAt: 1710000000000,
      });
      return eid;
    });

    const result = await t.query(api.dashboard.queries.getDashboardStats, {
      orgId: "org_1",
      calendarEditionId: editionId,
      year: 2026,
      now: 1710000000000,
    });

    expect(result.totalRevenue).toBe(5000000);
    expect(result.collectionRate).toBe(90);
    expect(result.outstandingBalance).toBe(500000);
    expect(result.latePaymentsCount).toBe(1);
  });

  it("getPrintInventoryData returns edition slots when data exists", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Advertiser",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
      });
      const eid = await ctx.db.insert("calendarEditions", {
        name: "Fall 2026",
        code: "FA26",
        orgId: "org_1",
      });
      const adId = await ctx.db.insert("advertisements", {
        name: "Banner",
        isDayType: false,
        slotsPerMonth: 2,
        orgId: "org_1",
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [eid],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      const apId = await ctx.db.insert("adPurchases", {
        purchaseId,
        advertisementId: adId,
        calendarEditionId: eid,
        quantity: 1,
        orgId: "org_1",
      });
      await ctx.db.insert("adSlots", {
        adPurchaseId: apId,
        advertisementId: adId,
        calendarEditionId: eid,
        year: 2026,
        month: 3,
        slotNumber: 1,
        orgId: "org_1",
      });
      return eid;
    });

    const result = await t.query(
      api.dashboard.queries.getPrintInventoryData,
      {
        orgId: "org_1",
        year: 2026,
        calendarEditionIds: [editionId],
      }
    );
    expect(result.editions).toHaveLength(1);
    expect(result.editions[0].slots).toHaveLength(1);
    expect(result.contacts.length).toBeGreaterThanOrEqual(1);
  });
});
