import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("categories", () => {
  it("tenant isolation — org_a cannot see org_b categories", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("categories", {
        name: "Sports",
        type: "event",
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await t.query(api.categories.queries.list, {
      orgId: "org_a",
    });
    expect(results).toHaveLength(0);
  });

  it("soft-deleted categories are excluded from list", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("categories", {
        name: "Active",
        type: "event",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("categories", {
        name: "Deleted",
        type: "event",
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await t.query(api.categories.queries.list, {
      orgId: "org_1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Active");
  });

  it("CRUD — create, read, update, softDelete", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const id = await t.mutation(api.categories.mutations.create, {
      orgId: "org_1",
      name: "Music",
      type: "event",
    });
    expect(id).toBeTruthy();

    const fetched = await t.query(api.categories.queries.getById, { id });
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Music");
    expect(fetched!.type).toBe("event");

    await t.mutation(api.categories.mutations.update, {
      id,
      name: "Live Music",
    });
    const updated = await t.query(api.categories.queries.getById, { id });
    expect(updated!.name).toBe("Live Music");

    await t.mutation(api.categories.mutations.softDelete, { id });
    const afterDelete = await t.query(api.categories.queries.getById, { id });
    expect(afterDelete!.isDeleted).toBe(true);
  });

  it("list filters by type when type argument is provided", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("categories", {
        name: "Tech Blog",
        type: "blog",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("categories", {
        name: "Community Event",
        type: "event",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const blogOnly = await t.query(api.categories.queries.list, {
      orgId: "org_1",
      type: "blog",
    });
    expect(blogOnly).toHaveLength(1);
    expect(blogOnly[0].name).toBe("Tech Blog");

    const all = await t.query(api.categories.queries.list, {
      orgId: "org_1",
    });
    expect(all).toHaveLength(2);
  });
});

describe("categories.seedBusinessCategories", () => {
  it("inserts business categories for the given org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(internal.categories.mutations.seedBusinessCategories, {
      orgId: "org_1",
      names: ["Accountants", "Bakeries, Donuts", "Fitness"],
    });

    const results = await t.query(api.categories.queries.list, {
      orgId: "org_1",
      type: "business",
    });
    expect(results).toHaveLength(3);
    expect(results.map((c) => c.name).sort()).toEqual([
      "Accountants",
      "Bakeries, Donuts",
      "Fitness",
    ]);
  });

  it("skips duplicates when run multiple times", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(internal.categories.mutations.seedBusinessCategories, {
      orgId: "org_1",
      names: ["Accountants", "Fitness"],
    });

    const result = await t.mutation(
      internal.categories.mutations.seedBusinessCategories,
      {
        orgId: "org_1",
        names: ["Accountants", "Fitness", "Bakeries, Donuts"],
      }
    );

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(2);

    const all = await t.query(api.categories.queries.list, {
      orgId: "org_1",
      type: "business",
    });
    expect(all).toHaveLength(3);
  });

  it("isolates seeded categories by org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_b" });

    await t.mutation(internal.categories.mutations.seedBusinessCategories, {
      orgId: "org_a",
      names: ["Accountants"],
    });

    const orgB = await t.query(api.categories.queries.list, {
      orgId: "org_b",
      type: "business",
    });
    expect(orgB).toHaveLength(0);
  });
});
