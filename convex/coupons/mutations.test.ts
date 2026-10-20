import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("coupons.mutations.create", () => {
  it("inserts a coupon with a seeded contact as businessContactId", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const contactId = await t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        company: "Acme Corp",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const couponId = await asOrg1.mutation(api.coupons.mutations.create, {
      businessContactId: contactId,
      title: "Free Coffee",
      startDate: 1700000000000,
      endDate: 1710000000000,
      description: "One free coffee",
      quantityLimit: 100,
      terms: "While supplies last",
    });

    const coupon = await t.run(async (ctx) => {
      return await ctx.db.get(couponId);
    });

    expect(coupon).not.toBeNull();
    expect(coupon!.title).toBe("Free Coffee");
    expect(coupon!.businessContactId).toBe(contactId);
    expect(coupon!.orgId).toBe("org_1");
    expect(coupon!.isDeleted).toBe(false);
    expect(coupon!.description).toBe("One free coffee");
    expect(coupon!.quantityLimit).toBe(100);
    expect(coupon!.terms).toBe("While supplies last");
  });

  it("inserts a coupon with perUserLimit", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const contactId = await t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        company: "Acme Corp",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const couponId = await asOrg1.mutation(api.coupons.mutations.create, {
      businessContactId: contactId,
      title: "Limited Per User",
      startDate: 1700000000000,
      endDate: 1710000000000,
      perUserLimit: 5,
    });

    const coupon = await t.run(async (ctx) => {
      return await ctx.db.get(couponId);
    });

    expect(coupon!.perUserLimit).toBe(5);
    expect(coupon!.quantityLimit).toBeUndefined();
  });

  it("inserts a coupon with only required fields", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const contactId = await t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        company: "Minimal Co",
        firstName: "Min",
        lastName: "Imal",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const couponId = await asOrg1.mutation(api.coupons.mutations.create, {
      businessContactId: contactId,
      title: "Basic Deal",
      startDate: 1700000000000,
      endDate: 1710000000000,
    });

    const coupon = await t.run(async (ctx) => {
      return await ctx.db.get(couponId);
    });

    expect(coupon!.title).toBe("Basic Deal");
    expect(coupon!.isDeleted).toBe(false);
  });

  it("rejects unauthenticated create", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.coupons.mutations.create, {
        businessContactId: contactId,
        title: "Should Fail",
        startDate: 1700000000000,
        endDate: 1710000000000,
      })
    ).rejects.toThrowError("Not authenticated");
  });
});

describe("coupons.mutations.softDelete", () => {
  it("marks coupon as isDeleted=true", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

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
        title: "To Delete",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await asOrg1.mutation(api.coupons.mutations.softDelete, { id: couponId });

    const coupon = await t.run(async (ctx) => {
      return await ctx.db.get(couponId);
    });
    expect(coupon!.isDeleted).toBe(true);
  });

  it("soft-deleted coupon is excluded from list query", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

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
        title: "Will Vanish",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const before = await asOrg.query(api.coupons.queries.list, { orgId: "org_1" });
    expect(before).toHaveLength(1);

    await asOrg1.mutation(api.coupons.mutations.softDelete, { id: couponId });

    const after = await asOrg.query(api.coupons.queries.list, { orgId: "org_1" });
    expect(after).toHaveLength(0);
  });

  it("rejects unauthenticated softDelete", async () => {
    const t = convexTest(schema, modules);

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
        title: "Protected",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.coupons.mutations.softDelete, { id: couponId })
    ).rejects.toThrowError("Not authenticated");
  });

  it("org_b cannot soft-delete org_a coupon", async () => {
    const t = convexTest(schema, modules);
    const asOrgB = t.withIdentity({ orgId: "org_b" });

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_a",
        isDeleted: false,
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Org A Only",
        startDate: 1700000000000,
        endDate: 1710000000000,
        orgId: "org_a",
        isDeleted: false,
      });
    });

    await expect(
      asOrgB.mutation(api.coupons.mutations.softDelete, { id: couponId })
    ).rejects.toThrowError("Not found");
  });
});
