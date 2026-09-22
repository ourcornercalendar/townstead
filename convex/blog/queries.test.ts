import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("blog.queries.list", () => {
  it("returns blog posts for the given orgId", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Hello World",
        slug: "hello-world",
        content: "Welcome to our blog",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const results = await t.query(api.blog.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Hello World");
  });

  it("tenant isolation — org A cannot see org B posts", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Org B Post",
        slug: "org-b-post",
        content: "Secret",
        status: "published",
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await t.query(api.blog.queries.list, { orgId: "org_a" });
    expect(results).toHaveLength(0);
  });

  it("excludes soft-deleted posts", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Active Post",
        slug: "active",
        content: "Active content",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Deleted Post",
        slug: "deleted",
        content: "Gone",
        status: "published",
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await t.query(api.blog.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Active Post");
  });

  it("filters by status when provided", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Draft Post",
        slug: "draft",
        content: "WIP",
        status: "draft",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Published Post",
        slug: "published",
        content: "Live",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Pending Post",
        slug: "pending",
        content: "Review me",
        status: "pending",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const drafts = await t.query(api.blog.queries.list, {
      orgId: "org_1",
      status: "draft",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe("Draft Post");

    const published = await t.query(api.blog.queries.list, {
      orgId: "org_1",
      status: "published",
    });
    expect(published).toHaveLength(1);
    expect(published[0].title).toBe("Published Post");
  });

  it("returns all statuses when status is not provided", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Draft",
        slug: "d",
        content: "c",
        status: "draft",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Published",
        slug: "p",
        content: "c",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const all = await t.query(api.blog.queries.list, { orgId: "org_1" });
    expect(all).toHaveLength(2);
  });
});

describe("blog.queries.getById", () => {
  it("returns the blog post by id", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "My Post",
        slug: "my-post",
        content: "Body text",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const post = await t.query(api.blog.queries.getById, { id: postId });
    expect(post).not.toBeNull();
    expect(post!.title).toBe("My Post");
    expect(post!.slug).toBe("my-post");
  });
});

describe("blog.queries.getBySlug", () => {
  it("returns the blog post matching orgId and slug", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Slug Post",
        slug: "slug-post",
        content: "Found by slug",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const post = await t.query(api.blog.queries.getBySlug, {
      orgId: "org_1",
      slug: "slug-post",
    });
    expect(post).not.toBeNull();
    expect(post!.title).toBe("Slug Post");
  });

  it("returns null when slug does not exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const post = await t.query(api.blog.queries.getBySlug, {
      orgId: "org_1",
      slug: "nonexistent",
    });
    expect(post).toBeNull();
  });

  it("excludes soft-deleted posts from slug lookup", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Deleted Slug",
        slug: "deleted-slug",
        content: "Gone",
        status: "published",
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const post = await t.query(api.blog.queries.getBySlug, {
      orgId: "org_1",
      slug: "deleted-slug",
    });
    expect(post).toBeNull();
  });

  it("tenant isolation — cannot access other org slug", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("blogPosts", {
        title: "Org B Slug",
        slug: "shared-slug",
        content: "Org B owns this",
        status: "published",
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const post = await t.query(api.blog.queries.getBySlug, {
      orgId: "org_a",
      slug: "shared-slug",
    });
    expect(post).toBeNull();
  });
});
