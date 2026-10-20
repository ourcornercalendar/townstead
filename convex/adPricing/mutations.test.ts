import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const testPrices = {
  jan: 10000, feb: 10000, mar: 10000, apr: 10000,
  may: 10000, jun: 10000, jul: 10000, aug: 10000,
  sep: 10000, oct: 10000, nov: 10000, dec: 10000,
};

const updatedPrices = {
  jan: 20000, feb: 20000, mar: 20000, apr: 20000,
  may: 20000, jun: 20000, jul: 20000, aug: 20000,
  sep: 20000, oct: 20000, nov: 20000, dec: 20000,
};

describe("adPricing.mutations.upsert", () => {
  it("creates a new pricing record when none exists", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId } = await t.run(async (ctx) => {
      const ad = await ctx.db.insert("advertisements", {
        name: "Full Page",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
        isDeleted: false,
      });
      const edition = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
        isDeleted: false,
      });
      return { adId: ad, editionId: edition };
    });

    const resultId = await t.mutation(api.adPricing.mutations.upsert, {
      orgId: "org_1",
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2026,
      monthlyPrices: testPrices,
    });

    const pricing = await t.run(async (ctx) => {
      return await ctx.db.get(resultId);
    });

    expect(pricing).not.toBeNull();
    expect(pricing!.advertisementId).toBe(adId);
    expect(pricing!.calendarEditionId).toBe(editionId);
    expect(pricing!.year).toBe(2026);
    expect(pricing!.monthlyPrices.jan).toBe(10000);
    expect(pricing!.orgId).toBe("org_1");
  });

  it("updates existing pricing record when one exists for same combo", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId } = await t.run(async (ctx) => {
      const ad = await ctx.db.insert("advertisements", {
        name: "Banner",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
        isDeleted: false,
      });
      const edition = await ctx.db.insert("calendarEditions", {
        name: "Fall 2026",
        code: "FA26",
        orgId: "org_1",
        isDeleted: false,
      });
      return { adId: ad, editionId: edition };
    });

    const firstId = await t.mutation(api.adPricing.mutations.upsert, {
      orgId: "org_1",
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2026,
      monthlyPrices: testPrices,
    });

    const secondId = await t.mutation(api.adPricing.mutations.upsert, {
      orgId: "org_1",
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2026,
      monthlyPrices: updatedPrices,
    });

    expect(secondId).toBe(firstId);

    const pricing = await t.run(async (ctx) => {
      return await ctx.db.get(firstId);
    });

    expect(pricing!.monthlyPrices.jan).toBe(20000);
    expect(pricing!.monthlyPrices.dec).toBe(20000);
  });

  it("creates separate records for different years", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const { adId, editionId } = await t.run(async (ctx) => {
      const ad = await ctx.db.insert("advertisements", {
        name: "Half Page",
        isDayType: false,
        slotsPerMonth: 2,
        orgId: "org_1",
        isDeleted: false,
      });
      const edition = await ctx.db.insert("calendarEditions", {
        name: "Edition A",
        code: "EA",
        orgId: "org_1",
        isDeleted: false,
      });
      return { adId: ad, editionId: edition };
    });

    const id2026 = await t.mutation(api.adPricing.mutations.upsert, {
      orgId: "org_1",
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2026,
      monthlyPrices: testPrices,
    });

    const id2027 = await t.mutation(api.adPricing.mutations.upsert, {
      orgId: "org_1",
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2027,
      monthlyPrices: updatedPrices,
    });

    expect(id2026).not.toBe(id2027);

    const all = await t.query(api.adPricing.queries.listByAdvertisement, {
      advertisementId: adId,
    });
    expect(all).toHaveLength(2);
  });
});
