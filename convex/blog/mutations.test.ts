import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("blog.mutations.create", () => {
  it("inserts a blog post with required fields", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const postId = await asOrg1.mutation(api.blog.mutations.create, {
      title: "First Post",
      slug: "first-post",
      content: "Hello world",
      status: "draft",
    });

    const post = await t.run(async (ctx) => {
      return await ctx.db.get(postId);
    });

    expect(post).not.toBeNull();
    expect(post!.title).toBe("First Post");
    expect(post!.slug).toBe("first-post");
    expect(post!.content).toBe("Hello world");
    expect(post!.status).toBe("draft");
    expect(post!.orgId).toBe("org_1");
    expect(post!.isDeleted).toBe(false);
  });

  it("inserts a blog post with optional fields", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const postId = await asOrg1.mutation(api.blog.mutations.create, {
      title: "Full Post",
      slug: "full-post",
      content: "Rich content",
      status: "published",
      excerpt: "A brief excerpt",
      authorId: "user_123",
      publishedAt: 1700000000000,
      seoTitle: "SEO Title",
      seoDescription: "SEO Description",
    });

    const post = await t.run(async (ctx) => {
      return await ctx.db.get(postId);
    });

    expect(post!.excerpt).toBe("A brief excerpt");
    expect(post!.authorId).toBe("user_123");
    expect(post!.publishedAt).toBe(1700000000000);
    expect(post!.seoTitle).toBe("SEO Title");
    expect(post!.seoDescription).toBe("SEO Description");
  });

  it("rejects unauthenticated create", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.blog.mutations.create, {
        title: "Should Fail",
        slug: "should-fail",
        content: "Nope",
        status: "draft",
      })
    ).rejects.toThrowError("Not authenticated");
  });
});

describe("blog.mutations.update", () => {
  it("patches only provided fields", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Original Title",
        slug: "original",
        content: "Original content",
        status: "draft",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await asOrg1.mutation(api.blog.mutations.update, {
      id: postId,
      title: "Updated Title",
      status: "published",
    });

    const post = await t.run(async (ctx) => {
      return await ctx.db.get(postId);
    });

    expect(post!.title).toBe("Updated Title");
    expect(post!.status).toBe("published");
    expect(post!.slug).toBe("original");
    expect(post!.content).toBe("Original content");
  });

  it("rejects unauthenticated update", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Protected",
        slug: "protected",
        content: "Secret",
        status: "draft",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.blog.mutations.update, {
        id: postId,
        title: "Hacked",
      })
    ).rejects.toThrowError("Not authenticated");
  });
});

describe("blog.mutations.softDelete", () => {
  it("marks blog post as isDeleted=true", async () => {
    const t = convexTest(schema, modules);
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "To Delete",
        slug: "to-delete",
        content: "Goodbye",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await asOrg1.mutation(api.blog.mutations.softDelete, { id: postId });

    const post = await t.run(async (ctx) => {
      return await ctx.db.get(postId);
    });
    expect(post!.isDeleted).toBe(true);
  });

  it("soft-deleted post is excluded from list query", async () => {
    const t = convexTest(schema, modules);
    const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const asOrg1 = t.withIdentity({ orgId: "org_1" });

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Bye",
        slug: "bye",
        content: "Gone",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const before = await asOrg.query(api.blog.queries.list, { orgId: "org_1" });
    expect(before).toHaveLength(1);

    await asOrg1.mutation(api.blog.mutations.softDelete, { id: postId });

    const after = await asOrg.query(api.blog.queries.list, { orgId: "org_1" });
    expect(after).toHaveLength(0);
  });

  it("rejects unauthenticated softDelete", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Protected",
        slug: "protected",
        content: "Secret",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.blog.mutations.softDelete, { id: postId })
    ).rejects.toThrowError("Not authenticated");
  });

  it("org_b cannot soft-delete org_a blog post", async () => {
    const t = convexTest(schema, modules);
    const asOrgB = t.withIdentity({ orgId: "org_b" });

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Org A Only",
        slug: "org-a-only",
        content: "Private",
        status: "published",
        orgId: "org_a",
        isDeleted: false,
      });
    });

    await expect(
      asOrgB.mutation(api.blog.mutations.softDelete, { id: postId })
    ).rejects.toThrowError("Not found");
  });
});
