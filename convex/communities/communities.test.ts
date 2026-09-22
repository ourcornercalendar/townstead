import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("communities.queries.list", () => {
  it("tenant isolation — org_a cannot see org_b communities", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("communities", {
        name: "Shelbyville",
        slug: "shelbyville",
        calendarEditionIds: [],
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await asOrg.query(api.communities.queries.list, {
      orgId: "org_a",
    });
    expect(results).toHaveLength(0);
  });

  it("soft-deleted communities are excluded from list", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("communities", {
        name: "Active Town",
        slug: "active-town",
        calendarEditionIds: [],
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("communities", {
        name: "Deleted Town",
        slug: "deleted-town",
        calendarEditionIds: [],
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await asOrg.query(api.communities.queries.list, {
      orgId: "org_1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Active Town");
  });
});

describe("communities.queries.getBySlug", () => {
  it("resolves community by orgId and slug", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("communities", {
        name: "Springfield",
        slug: "springfield",
        calendarEditionIds: [],
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const result = await asOrg.query(api.communities.queries.getBySlug, {
      orgId: "org_1",
      slug: "springfield",
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Springfield");
  });

  it("returns null for non-existent slug", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const result = await asOrg.query(api.communities.queries.getBySlug, {
      orgId: "org_1",
      slug: "does-not-exist",
    });
    expect(result).toBeNull();
  });

  it("excludes soft-deleted communities from slug lookup", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("communities", {
        name: "Gone Town",
        slug: "gone-town",
        calendarEditionIds: [],
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const result = await asOrg.query(api.communities.queries.getBySlug, {
      orgId: "org_1",
      slug: "gone-town",
    });
    expect(result).toBeNull();
  });
});

describe("communities.mutations.create", () => {
  it("rejects unauthenticated calls", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.communities.mutations.create, {
        name: "Test",
        slug: "test",
        calendarEditionIds: [],
      })
    ).rejects.toThrowError("Not authenticated");
  });

  it("creates a community with valid identity", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const id = await asOrg1.mutation(api.communities.mutations.create, {
      name: "Springfield",
      slug: "springfield",
      description: "A great community",
      calendarEditionIds: [],
    });
    expect(id).toBeTruthy();

    const doc = await asOrg.query(api.communities.queries.getById, { id });
    expect(doc).not.toBeNull();
    expect(doc!.name).toBe("Springfield");
    expect(doc!.slug).toBe("springfield");
    expect(doc!.orgId).toBe("org_1");
    expect(doc!.isDeleted).toBe(false);
  });

  it("rejects duplicate slug within same org", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    await asOrg1.mutation(api.communities.mutations.create, {
      name: "Springfield",
      slug: "springfield",
      calendarEditionIds: [],
    });

    await expect(
      asOrg1.mutation(api.communities.mutations.create, {
        name: "Springfield 2",
        slug: "springfield",
        calendarEditionIds: [],
      })
    ).rejects.toThrowError("A community with this slug already exists");
  });
});

describe("communities.mutations.update", () => {
  it("patches provided fields only", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const id = await asOrg1.mutation(api.communities.mutations.create, {
      name: "Old Name",
      slug: "old-name",
      calendarEditionIds: [],
    });

    await asOrg1.mutation(api.communities.mutations.update, {
      id,
      name: "New Name",
    });

    const doc = await asOrg.query(api.communities.queries.getById, { id });
    expect(doc!.name).toBe("New Name");
    expect(doc!.slug).toBe("old-name");
  });

  it("rejects update from different org", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });
    const asOrg2 = t.withIdentity({ orgId: "org_2" });

    const id = await asOrg1.mutation(api.communities.mutations.create, {
      name: "Org 1 Town",
      slug: "org1-town",
      calendarEditionIds: [],
    });

    await expect(
      asOrg2.mutation(api.communities.mutations.update, {
        id,
        name: "Hijacked",
      })
    ).rejects.toThrowError("Not found");
  });
});

describe("communities.mutations.softDelete", () => {
  it("marks community as isDeleted=true", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const id = await asOrg1.mutation(api.communities.mutations.create, {
      name: "Doomed Town",
      slug: "doomed-town",
      calendarEditionIds: [],
    });

    await asOrg1.mutation(api.communities.mutations.softDelete, { id });

    const doc = await asOrg.query(api.communities.queries.getById, { id });
    expect(doc!.isDeleted).toBe(true);
  });

  it("soft-deleted community is excluded from list query", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const id = await asOrg1.mutation(api.communities.mutations.create, {
      name: "Will Vanish",
      slug: "will-vanish",
      calendarEditionIds: [],
    });

    const before = await asOrg.query(api.communities.queries.list, {
      orgId: "org_1",
    });
    expect(before).toHaveLength(1);

    await asOrg1.mutation(api.communities.mutations.softDelete, { id });

    const after = await asOrg.query(api.communities.queries.list, {
      orgId: "org_1",
    });
    expect(after).toHaveLength(0);
  });

  it("rejects delete from different org", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });
    const asOrg2 = t.withIdentity({ orgId: "org_2" });

    const id = await asOrg1.mutation(api.communities.mutations.create, {
      name: "Protected Town",
      slug: "protected-town",
      calendarEditionIds: [],
    });

    await expect(
      asOrg2.mutation(api.communities.mutations.softDelete, { id })
    ).rejects.toThrowError("Not found");
  });
});
