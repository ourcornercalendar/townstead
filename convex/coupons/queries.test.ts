import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("coupons.queries.list", () => {
  it("returns coupons for the given orgId", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "20% Off",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const results = await t.query(api.coupons.queries.list, {
      orgId: "org_1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("20% Off");
  });

  it("tenant isolation — org A cannot see org B coupons", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Other Co",
        firstName: "Bob",
        lastName: "Smith",
        orgId: "org_b",
        isDeleted: false,
      });
      await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Org B Coupon",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await t.query(api.coupons.queries.list, {
      orgId: "org_a",
    });
    expect(results).toHaveLength(0);
  });

  it("excludes soft-deleted coupons", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Active Coupon",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Deleted Coupon",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await t.query(api.coupons.queries.list, {
      orgId: "org_1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Active Coupon");
  });
});

describe("coupons.queries.getById", () => {
  it("returns the coupon by id", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "BOGO",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const coupon = await t.query(api.coupons.queries.getById, { id: couponId });
    expect(coupon).not.toBeNull();
    expect(coupon!.title).toBe("BOGO");
  });
});

describe("coupons.queries.getClaimCount", () => {
  it("returns count of claims for coupon", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
      const cId = await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Limited",
        startDate: 1700000000000,
        endDate: 1710000000000,
        quantityLimit: 10,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("couponClaims", {
        couponId: cId,
        userId: "user_1",
        claimedAt: 1700000001000,
      });
      await ctx.db.insert("couponClaims", {
        couponId: cId,
        userId: "user_2",
        claimedAt: 1700000002000,
      });
      return cId;
    });

    const count = await t.query(api.coupons.queries.getClaimCount, {
      couponId,
    });
    expect(count).toBe(2);
  });

  it("returns 0 when no claims exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "No Claims",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const count = await t.query(api.coupons.queries.getClaimCount, {
      couponId,
    });
    expect(count).toBe(0);
  });
});
