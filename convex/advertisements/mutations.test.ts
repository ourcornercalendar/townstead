import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("advertisements.mutations.create", () => {
  it("creates an advertisement with the given fields", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1",
      name: "Full Page",
      isDayType: false,
      slotsPerMonth: 1,
    });

    const ad = await t.run(async (ctx) => ctx.db.get(adId));
    expect(ad).not.toBeNull();
    expect(ad!.name).toBe("Full Page");
    expect(ad!.isDayType).toBe(false);
    expect(ad!.slotsPerMonth).toBe(1);
    expect(ad!.orgId).toBe("org_1");
    expect(ad!.isDeleted).toBe(false);
  });

  it("creates a day-type advertisement", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1",
      name: "Daily Banner",
      isDayType: true,
      slotsPerMonth: 30,
    });

    const ad = await t.run(async (ctx) => ctx.db.get(adId));
    expect(ad!.isDayType).toBe(true);
    expect(ad!.slotsPerMonth).toBe(30);
  });

  it("allows creating ads with the same name in the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const id1 = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1", name: "Banner", isDayType: false, slotsPerMonth: 1,
    });
    const id2 = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1", name: "Banner", isDayType: true, slotsPerMonth: 30,
    });

    expect(id1).not.toBe(id2);
  });
});

describe("advertisements.mutations.softDelete", () => {
  it("marks the advertisement as deleted", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1", name: "To Delete", isDayType: false, slotsPerMonth: 1,
    });

    await t.mutation(api.advertisements.mutations.softDelete, { id: adId });

    const deleted = await t.run(async (ctx) => ctx.db.get(adId));
    expect(deleted!.isDeleted).toBe(true);
  });

  it("soft-deleted ad no longer appears in list queries", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const adId = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1", name: "Will Delete", isDayType: false, slotsPerMonth: 1,
    });

    await t.mutation(api.advertisements.mutations.softDelete, { id: adId });

    const results = await t.query(api.advertisements.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(0);
  });

  it("only affects the targeted ad, not others in the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const keepId = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1", name: "Keep This", isDayType: false, slotsPerMonth: 1,
    });
    const deleteId = await t.mutation(api.advertisements.mutations.create, {
      orgId: "org_1", name: "Delete This", isDayType: true, slotsPerMonth: 30,
    });

    await t.mutation(api.advertisements.mutations.softDelete, { id: deleteId });

    const results = await t.query(api.advertisements.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0]._id).toBe(keepId);
  });
});
