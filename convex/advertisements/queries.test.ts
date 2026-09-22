import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("advertisements.queries.list", () => {
  it("returns ads for the given org only (tenant isolation)", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("advertisements", {
        name: "Full Page", isDayType: false, slotsPerMonth: 1,
        orgId: "org_a", isDeleted: false,
      });
      await ctx.db.insert("advertisements", {
        name: "Half Page", isDayType: false, slotsPerMonth: 2,
        orgId: "org_b", isDeleted: false,
      });
    });

    const results = await t.query(api.advertisements.queries.list, { orgId: "org_a" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Full Page");
  });

  it("org_b query returns empty when only org_a data exists", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_b" });

    await t.run(async (ctx) => {
      await ctx.db.insert("advertisements", {
        name: "Banner", isDayType: true, slotsPerMonth: 30,
        orgId: "org_a", isDeleted: false,
      });
    });

    const results = await t.query(api.advertisements.queries.list, { orgId: "org_b" });
    expect(results).toHaveLength(0);
  });

  it("excludes soft-deleted ads", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("advertisements", {
        name: "Active Ad", isDayType: false, slotsPerMonth: 1,
        orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("advertisements", {
        name: "Deleted Ad", isDayType: true, slotsPerMonth: 30,
        orgId: "org_1", isDeleted: true,
      });
    });

    const results = await t.query(api.advertisements.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Active Ad");
  });

  it("returns multiple non-deleted ads for the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("advertisements", {
        name: "Ad One", isDayType: false, slotsPerMonth: 1,
        orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("advertisements", {
        name: "Ad Two", isDayType: true, slotsPerMonth: 30,
        orgId: "org_1", isDeleted: false,
      });
    });

    const results = await t.query(api.advertisements.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(2);
  });
});

describe("advertisements.queries.getById", () => {
  it("returns the ad document by ID", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.run(async (ctx) => {
      return await ctx.db.insert("advertisements", {
        name: "Quarter Page", isDayType: false, slotsPerMonth: 4,
        orgId: "org_1", isDeleted: false,
      });
    });

    const result = await t.query(api.advertisements.queries.getById, { id: adId });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Quarter Page");
    expect(result!.isDayType).toBe(false);
    expect(result!.slotsPerMonth).toBe(4);
  });

  it("returns null for a nonexistent ID", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("advertisements", {
        name: "Temp", isDayType: false, slotsPerMonth: 1, orgId: "org_1",
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(api.advertisements.queries.getById, { id: fakeId });
    expect(result).toBeNull();
  });
});
