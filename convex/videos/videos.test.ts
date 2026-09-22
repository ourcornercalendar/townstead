import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("videos", () => {
  it("tenant isolation — org_a cannot see org_b videos", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("videos", {
        title: "Org B Video",
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await asOrg.query(api.videos.queries.list, {
      orgId: "org_a",
    });
    expect(results).toHaveLength(0);
  });

  it("soft-deleted videos are excluded from list", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("videos", {
        title: "Active Video",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("videos", {
        title: "Deleted Video",
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await asOrg.query(api.videos.queries.list, {
      orgId: "org_1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Active Video");
  });

  it("CRUD — create, getById, update, softDelete", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const id = await asOrg1.mutation(api.videos.mutations.create, {
      title: "Promo Video",
      description: "Our best promo",
      url: "https://example.com/video.mp4",
    });
    expect(id).toBeTruthy();

    const fetched = await asOrg.query(api.videos.queries.getById, { id });
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe("Promo Video");
    expect(fetched!.url).toBe("https://example.com/video.mp4");

    await asOrg1.mutation(api.videos.mutations.update, {
      id,
      title: "Updated Promo",
    });
    const updated = await asOrg.query(api.videos.queries.getById, { id });
    expect(updated!.title).toBe("Updated Promo");
    expect(updated!.description).toBe("Our best promo");

    await asOrg1.mutation(api.videos.mutations.softDelete, { id });
    const deleted = await asOrg.query(api.videos.queries.getById, { id });
    expect(deleted!.isDeleted).toBe(true);

    const listed = await asOrg.query(api.videos.queries.list, {
      orgId: "org_1",
    });
    expect(listed).toHaveLength(0);
  });

  it("rejects unauthenticated create", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.videos.mutations.create, {
        title: "Should Fail",
        url: "https://example.com/fail.mp4",
      })
    ).rejects.toThrowError("Not authenticated");
  });

  it("rejects unauthenticated update", async () => {
    const t = convexTest(schema, modules);

    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("videos", {
        title: "Existing",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.videos.mutations.update, { id, title: "Hacked" })
    ).rejects.toThrowError("Not authenticated");
  });

  it("rejects unauthenticated softDelete", async () => {
    const t = convexTest(schema, modules);

    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("videos", {
        title: "Protected",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.videos.mutations.softDelete, { id })
    ).rejects.toThrowError("Not authenticated");
  });

  it("org_b cannot soft-delete org_a video", async () => {
    const t = convexTest(schema, modules);
    const asOrgB = t.withIdentity({ orgId: "org_b" });

    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("videos", {
        title: "Org A Only",
        orgId: "org_a",
        isDeleted: false,
      });
    });

    await expect(
      asOrgB.mutation(api.videos.mutations.softDelete, { id })
    ).rejects.toThrowError("Not found");
  });
});
