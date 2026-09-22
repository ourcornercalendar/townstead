import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const zeroPrices = {
  jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
  jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
};

describe("adPricing.queries.listByAdvertisement", () => {
  it("returns pricing records for an advertisement", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.run(async (ctx) => {
      const ad = await ctx.db.insert("advertisements", {
        name: "Full Page",
        isDayType: false,
        slotsPerMonth: 1,
        orgId: "org_1",
        isDeleted: false,
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("adPricing", {
        advertisementId: ad,
        calendarEditionId: editionId,
        year: 2026,
        monthlyPrices: {
          jan: 10000, feb: 10000, mar: 12000, apr: 12000,
          may: 15000, jun: 15000, jul: 15000, aug: 12000,
          sep: 12000, oct: 10000, nov: 10000, dec: 10000,
        },
        orgId: "org_1",
      });
      return ad;
    });

    const results = await t.query(api.adPricing.queries.listByAdvertisement, {
      advertisementId: adId,
    });
    expect(results).toHaveLength(1);
    expect(results[0].year).toBe(2026);
    expect(results[0].monthlyPrices.jan).toBe(10000);
    expect(results[0].monthlyPrices.may).toBe(15000);
  });

  it("returns empty when no pricing exists for advertisement", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.run(async (ctx) => {
      return await ctx.db.insert("advertisements", {
        name: "Quarter Page",
        isDayType: false,
        slotsPerMonth: 4,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const results = await t.query(api.adPricing.queries.listByAdvertisement, {
      advertisementId: adId,
    });
    expect(results).toHaveLength(0);
  });

  it("returns multiple pricing records for same ad, different editions/years", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.run(async (ctx) => {
      const ad = await ctx.db.insert("advertisements", {
        name: "Half Page",
        isDayType: false,
        slotsPerMonth: 2,
        orgId: "org_1",
        isDeleted: false,
      });
      const ed1 = await ctx.db.insert("calendarEditions", {
        name: "Edition A",
        code: "EA",
        orgId: "org_1",
        isDeleted: false,
      });
      const ed2 = await ctx.db.insert("calendarEditions", {
        name: "Edition B",
        code: "EB",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("adPricing", {
        advertisementId: ad,
        calendarEditionId: ed1,
        year: 2026,
        monthlyPrices: zeroPrices,
        orgId: "org_1",
      });
      await ctx.db.insert("adPricing", {
        advertisementId: ad,
        calendarEditionId: ed2,
        year: 2027,
        monthlyPrices: zeroPrices,
        orgId: "org_1",
      });
      return ad;
    });

    const results = await t.query(api.adPricing.queries.listByAdvertisement, {
      advertisementId: adId,
    });
    expect(results).toHaveLength(2);
  });
});

describe("adPricing.queries.getByAdEditionYear", () => {
  it("returns pricing for ad+edition+year combo", async () => {
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
      await ctx.db.insert("adPricing", {
        advertisementId: ad,
        calendarEditionId: edition,
        year: 2026,
        monthlyPrices: {
          jan: 5000, feb: 5000, mar: 5000, apr: 5000,
          may: 5000, jun: 5000, jul: 5000, aug: 5000,
          sep: 5000, oct: 5000, nov: 5000, dec: 5000,
        },
        orgId: "org_1",
      });
      return { adId: ad, editionId: edition };
    });

    const pricing = await t.query(api.adPricing.queries.getByAdEditionYear, {
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2026,
    });

    expect(pricing).not.toBeNull();
    expect(pricing!.monthlyPrices.jan).toBe(5000);
    expect(pricing!.year).toBe(2026);
  });

  it("returns null when no matching combo exists", async () => {
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

    const pricing = await t.query(api.adPricing.queries.getByAdEditionYear, {
      advertisementId: adId,
      calendarEditionId: editionId,
      year: 2099,
    });
    expect(pricing).toBeNull();
  });
});
