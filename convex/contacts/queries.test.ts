import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("contacts.queries.list", () => {
  it("returns contacts for the given org only (tenant isolation)", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "Acme", firstName: "Alice", lastName: "Smith",
        orgId: "org_a", isDeleted: false,
      });
      await ctx.db.insert("contacts", {
        company: "Beta", firstName: "Bob", lastName: "Jones",
        orgId: "org_b", isDeleted: false,
      });
    });

    const results = await t.query(api.contacts.queries.list, { orgId: "org_a" });
    expect(results).toHaveLength(1);
    expect(results[0].company).toBe("Acme");
  });

  it("org_b query returns empty when only org_a data exists", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_b" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "Acme", firstName: "Alice", lastName: "Smith",
        orgId: "org_a", isDeleted: false,
      });
    });

    const results = await t.query(api.contacts.queries.list, { orgId: "org_b" });
    expect(results).toHaveLength(0);
  });

  it("excludes soft-deleted contacts", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "Active Co", firstName: "Jane", lastName: "Doe",
        orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("contacts", {
        company: "Deleted Co", firstName: "Del", lastName: "Eted",
        orgId: "org_1", isDeleted: true,
      });
    });

    const results = await t.query(api.contacts.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].company).toBe("Active Co");
  });

  it("returns multiple non-deleted contacts for the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "A Corp", firstName: "A", lastName: "One",
        orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("contacts", {
        company: "B Corp", firstName: "B", lastName: "Two",
        orgId: "org_1", isDeleted: false,
      });
    });

    const results = await t.query(api.contacts.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(2);
  });
});

describe("contacts.queries.getById", () => {
  it("returns the contact document by ID", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const contactId = await t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        company: "Test Co", firstName: "John", lastName: "Doe",
        email: "john@test.com", orgId: "org_1", isDeleted: false,
      });
    });

    const result = await t.query(api.contacts.queries.getById, { id: contactId });
    expect(result).not.toBeNull();
    expect(result!.company).toBe("Test Co");
    expect(result!.firstName).toBe("John");
    expect(result!.email).toBe("john@test.com");
  });

  it("returns null for a nonexistent ID", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("contacts", {
        company: "Temp", firstName: "T", lastName: "T", orgId: "org_1",
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(api.contacts.queries.getById, { id: fakeId });
    expect(result).toBeNull();
  });
});

describe("contacts.queries.search", () => {
  it("returns contacts matching the search term", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "Acme Corp", firstName: "Alice", lastName: "Wonder",
        searchText: "Acme Corp Alice Wonder", orgId: "org_1", isDeleted: false,
      });
      await ctx.db.insert("contacts", {
        company: "Beta Inc", firstName: "Bob", lastName: "Builder",
        searchText: "Beta Inc Bob Builder", orgId: "org_1", isDeleted: false,
      });
    });

    const results = await t.query(api.contacts.queries.search, {
      orgId: "org_1", searchTerm: "Alice",
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((c) => c.firstName === "Alice")).toBe(true);
  });

  it("excludes soft-deleted contacts from search results", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "Deleted Co", firstName: "Gone", lastName: "Away",
        searchText: "Deleted Co Gone Away", orgId: "org_1", isDeleted: true,
      });
      await ctx.db.insert("contacts", {
        company: "Active Co", firstName: "Still", lastName: "Here",
        searchText: "Active Co Still Here", orgId: "org_1", isDeleted: false,
      });
    });

    const results = await t.query(api.contacts.queries.search, {
      orgId: "org_1", searchTerm: "Gone",
    });
    expect(results.every((c) => c.isDeleted !== true)).toBe(true);
  });

  it("respects tenant isolation in search", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        company: "Secret Corp", firstName: "Hidden", lastName: "User",
        searchText: "Secret Corp Hidden User", orgId: "org_b", isDeleted: false,
      });
    });

    const results = await t.query(api.contacts.queries.search, {
      orgId: "org_a", searchTerm: "Hidden",
    });
    expect(results).toHaveLength(0);
  });
});
