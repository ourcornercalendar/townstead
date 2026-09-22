import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("addressBooks", () => {
  it("tenant isolation — org_a cannot see org_b address books", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("addressBooks", {
        name: "Premium",
        orgId: "org_b",
      });
    });

    const results = await t.query(api.addressBooks.queries.list, {
      orgId: "org_a",
    });
    expect(results).toHaveLength(0);
  });

  it("CRUD — create, list, update, remove", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const id = await t.mutation(api.addressBooks.mutations.create, {
      orgId: "org_1",
      name: "Gold Members",
      displayLevel: "featured",
    });
    expect(id).toBeTruthy();

    const list = await t.query(api.addressBooks.queries.list, {
      orgId: "org_1",
    });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Gold Members");
    expect(list[0].displayLevel).toBe("featured");

    await t.mutation(api.addressBooks.mutations.update, {
      id,
      name: "Platinum Members",
      displayLevel: "standard",
    });

    const updated = await t.query(api.addressBooks.queries.list, {
      orgId: "org_1",
    });
    expect(updated[0].name).toBe("Platinum Members");

    await t.mutation(api.addressBooks.mutations.remove, { id });

    const afterRemove = await t.query(api.addressBooks.queries.list, {
      orgId: "org_1",
    });
    expect(afterRemove).toHaveLength(0);
  });

  it("list returns multiple address books for the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("addressBooks", { name: "A", orgId: "org_1" });
      await ctx.db.insert("addressBooks", { name: "B", orgId: "org_1" });
      await ctx.db.insert("addressBooks", { name: "C", orgId: "org_2" });
    });

    const results = await t.query(api.addressBooks.queries.list, {
      orgId: "org_1",
    });
    expect(results).toHaveLength(2);
  });
});
