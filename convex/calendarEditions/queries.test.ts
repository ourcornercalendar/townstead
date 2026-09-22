import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("calendarEditions.queries.list", () => {
  it("returns editions for the given org only (tenant isolation)", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("calendarEditions", {
        name: "Spring 2026", code: "SP26", orgId: "org_a", isDeleted: false,
      });
      await ctx.db.insert("calendarEditions", {
        name: "Fall 2026", code: "FA26", orgId: "org_b", isDeleted: false,
      });
    });

    const results = await t.query(api.calendarEditions.queries.list, { orgId: "org_a" });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("SP26");
  });

  it("org_b query returns empty when only org_a data exists", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_b" });

    await t.run(async (ctx) => {
      await ctx.db.insert("calendarEditions", {
        name: "Spring 2026", code: "SP26", orgId: "org_a", isDeleted: false,
      });
    });

    const results = await t.query(api.calendarEditions.queries.list, { orgId: "org_b" });
    expect(results).toHaveLength(0);
  });

  it("excludes soft-deleted editions", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("calendarEditions", {
        name: "Active", code: "ACT", orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("calendarEditions", {
        name: "Deleted", code: "DEL", orgId: "org_1", isDeleted: true,
      });
    });

    const results = await t.query(api.calendarEditions.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("ACT");
  });

  it("returns multiple non-deleted editions for the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("calendarEditions", {
        name: "Spring", code: "SP", orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("calendarEditions", {
        name: "Fall", code: "FA", orgId: "org_1", isDeleted: false,
      });
    });

    const results = await t.query(api.calendarEditions.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(2);
  });
});

describe("calendarEditions.queries.getById", () => {
  it("returns the edition document by ID", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) => {
      return await ctx.db.insert("calendarEditions", {
        name: "Winter 2026", code: "WI26", orgId: "org_1", isDeleted: false,
      });
    });

    const result = await t.query(api.calendarEditions.queries.getById, { id: editionId });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Winter 2026");
    expect(result!.code).toBe("WI26");
  });

  it("returns null for a nonexistent ID", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("calendarEditions", {
        name: "Temp", code: "TMP", orgId: "org_1",
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(api.calendarEditions.queries.getById, { id: fakeId });
    expect(result).toBeNull();
  });
});
