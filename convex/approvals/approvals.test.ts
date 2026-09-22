import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS } from "../permissions";

const _factory = () => convexTest(schema, modules);
type TestInstance = ReturnType<typeof _factory>;

function setupAdmin(t: TestInstance) {
  return t.withIdentity({ subject: "admin_user", orgId: "org_1" });
}

async function seedOrg(t: TestInstance) {
  await t.run(async (ctx) => {
    await ctx.db.insert("orgPermissions", {
      userId: "admin_user",
      orgId: "org_1",
      role: "admin",
      permissions: [],
      isActive: true,
    });
  });
}

describe("approvals.queries.countPending", () => {
  it("returns zero counts when no pending content", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const counts = await admin.query(api.approvals.queries.countPending, {});
    expect(counts).toEqual({ events: 0, blog: 0, videos: 0, total: 0 });
  });

  it("counts pending events, blog posts, and videos", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Pending Event",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
        submittedBy: "user_1",
      });
      await ctx.db.insert("events", {
        name: "Approved Event",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: true,
      });
      await ctx.db.insert("blogPosts", {
        title: "Pending Post",
        slug: "pending",
        content: "Content",
        status: "pending",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Published Post",
        slug: "published",
        content: "Content",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("videos", {
        title: "Pending Video",
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
        submittedBy: "user_1",
      });
    });

    const counts = await admin.query(api.approvals.queries.countPending, {});
    expect(counts.events).toBe(1);
    expect(counts.blog).toBe(1);
    expect(counts.videos).toBe(1);
    expect(counts.total).toBe(3);
  });

  it("excludes soft-deleted items from pending counts", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Deleted Pending",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: true,
        isApproved: false,
      });
    });

    const counts = await admin.query(api.approvals.queries.countPending, {});
    expect(counts.events).toBe(0);
    expect(counts.total).toBe(0);
  });

  it("tenant isolation — org_b pending content not visible to org_a admin", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Other Org Event",
        date: 1800000000000,
        orgId: "org_b",
        isDeleted: false,
        isApproved: false,
      });
    });

    const counts = await admin.query(api.approvals.queries.countPending, {});
    expect(counts.events).toBe(0);
    expect(counts.total).toBe(0);
  });
});

describe("approvals.queries.listPending", () => {
  it("returns pending items grouped by type", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Pending Event",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Pending Post",
        slug: "pending",
        content: "Content",
        status: "pending",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("videos", {
        title: "Pending Video",
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
    });

    const result = await admin.query(api.approvals.queries.listPending, {});
    expect(result.events).toHaveLength(1);
    expect(result.blogPosts).toHaveLength(1);
    expect(result.videos).toHaveLength(1);
  });

  it("filters by type when specified", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Pending Event",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Pending Post",
        slug: "pending",
        content: "Content",
        status: "pending",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const eventsOnly = await admin.query(api.approvals.queries.listPending, {
      type: "events",
    });
    expect(eventsOnly.events).toHaveLength(1);
    expect(eventsOnly.blogPosts).toHaveLength(0);
    expect(eventsOnly.videos).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.approvals.queries.countPending, {})
    ).rejects.toThrowError("Not authenticated");
  });
});

describe("events.mutations.approve", () => {
  it("sets isApproved to true", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Pending Event",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
        submittedBy: "user_1",
      });
    });

    await admin.mutation(api.events.mutations.approve, { id: eventId });

    const event = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(event!.isApproved).toBe(true);
  });

  it("rejects when event belongs to different org", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Other Org Event",
        date: 1800000000000,
        orgId: "org_b",
        isDeleted: false,
        isApproved: false,
      });
    });

    await expect(
      admin.mutation(api.events.mutations.approve, { id: eventId })
    ).rejects.toThrowError("Not found");
  });
});

describe("events.mutations.reject", () => {
  it("soft-deletes the event", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Rejected Event",
        date: 1800000000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
    });

    await admin.mutation(api.events.mutations.reject, { id: eventId });

    const event = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(event!.isDeleted).toBe(true);
  });
});

describe("blog.mutations.approve", () => {
  it("sets status to published and publishedAt", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Pending Post",
        slug: "pending",
        content: "Content",
        status: "pending",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await admin.mutation(api.blog.mutations.approve, { id: postId });

    const post = await t.run(async (ctx) => ctx.db.get(postId));
    expect(post!.status).toBe("published");
    expect(post!.publishedAt).toBeTypeOf("number");
  });
});

describe("blog.mutations.reject", () => {
  it("sets status back to draft", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("blogPosts", {
        title: "Pending Post",
        slug: "pending",
        content: "Content",
        status: "pending",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await admin.mutation(api.blog.mutations.reject, { id: postId });

    const post = await t.run(async (ctx) => ctx.db.get(postId));
    expect(post!.status).toBe("draft");
  });
});

describe("videos.mutations.approve", () => {
  it("sets isApproved to true", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const videoId = await t.run(async (ctx) => {
      return await ctx.db.insert("videos", {
        title: "Pending Video",
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
        submittedBy: "user_1",
      });
    });

    await admin.mutation(api.videos.mutations.approve, { id: videoId });

    const video = await t.run(async (ctx) => ctx.db.get(videoId));
    expect(video!.isApproved).toBe(true);
  });
});

describe("videos.mutations.reject", () => {
  it("soft-deletes the video", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const admin = setupAdmin(t);

    const videoId = await t.run(async (ctx) => {
      return await ctx.db.insert("videos", {
        title: "Rejected Video",
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
    });

    await admin.mutation(api.videos.mutations.reject, { id: videoId });

    const video = await t.run(async (ctx) => ctx.db.get(videoId));
    expect(video!.isDeleted).toBe(true);
  });
});

describe("public.mutations.submitBlog", () => {
  it("requires authentication", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "blog-submit-org",
        siteName: "Blog Submit Org",
      });
    });

    await expect(
      t.mutation(api.public.mutations.submitBlog, {
        orgSlug: "blog-submit-org",
        title: "Anon Post",
        slug: "anon-post",
        content: "Content",
      })
    ).rejects.toThrowError("Not authenticated");
  });

  it("creates a pending blog post with blog:submit permission", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "blog-submit-org",
        siteName: "Blog Submit Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.BLOG_SUBMIT],
      });
    });

    const authed = t.withIdentity({ subject: "user_blogger" });
    const postId = await authed.mutation(api.public.mutations.submitBlog, {
      orgSlug: "blog-submit-org",
      title: "My Post",
      slug: "my-post",
      content: "Great content",
    });
    expect(postId).toBeTruthy();

    const doc = await t.run(async (ctx) => ctx.db.get(postId));
    expect(doc!.title).toBe("My Post");
    expect(doc!.status).toBe("pending");
    expect(doc!.submittedBy).toBe("user_blogger");
    expect(doc!.orgId).toBe("org_1");
  });

  it("auto-publishes with blog:create permission", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "blog-auto-org",
        siteName: "Blog Auto Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.BLOG_CREATE],
      });
    });

    const authed = t.withIdentity({ subject: "trusted_blogger" });
    const postId = await authed.mutation(api.public.mutations.submitBlog, {
      orgSlug: "blog-auto-org",
      title: "Auto Post",
      slug: "auto-post",
      content: "Content",
    });

    const doc = await t.run(async (ctx) => ctx.db.get(postId));
    expect(doc!.status).toBe("published");
    expect(doc!.publishedAt).toBeTypeOf("number");
  });
});

describe("public.mutations.submitVideo", () => {
  it("requires authentication", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "vid-submit-org",
        siteName: "Vid Submit Org",
      });
    });

    await expect(
      t.mutation(api.public.mutations.submitVideo, {
        orgSlug: "vid-submit-org",
        title: "Anon Video",
        url: "https://youtube.com/watch?v=123",
      })
    ).rejects.toThrowError("Not authenticated");
  });

  it("creates a pending video with videos:submit permission", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "vid-submit-org",
        siteName: "Vid Submit Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.VIDEOS_SUBMIT],
      });
    });

    const authed = t.withIdentity({ subject: "user_videographer" });
    const videoId = await authed.mutation(api.public.mutations.submitVideo, {
      orgSlug: "vid-submit-org",
      title: "My Video",
      url: "https://youtube.com/watch?v=abc",
    });
    expect(videoId).toBeTruthy();

    const doc = await t.run(async (ctx) => ctx.db.get(videoId));
    expect(doc!.title).toBe("My Video");
    expect(doc!.isApproved).toBe(false);
    expect(doc!.submittedBy).toBe("user_videographer");
    expect(doc!.orgId).toBe("org_1");
  });

  it("auto-approves with videos:create permission", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "vid-auto-org",
        siteName: "Vid Auto Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.VIDEOS_CREATE],
      });
    });

    const authed = t.withIdentity({ subject: "trusted_vid" });
    const videoId = await authed.mutation(api.public.mutations.submitVideo, {
      orgSlug: "vid-auto-org",
      title: "Auto Video",
      url: "https://youtube.com/watch?v=xyz",
    });

    const doc = await t.run(async (ctx) => ctx.db.get(videoId));
    expect(doc!.isApproved).toBe(true);
  });
});

describe("public.queries.listVideos — approval filtering", () => {
  it("excludes unapproved videos from public listing", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "vid-list-org",
        siteName: "Vid List Org",
      });
      await ctx.db.insert("videos", {
        title: "Approved Video",
        orgId: "org_1",
        isDeleted: false,
        isApproved: true,
      });
      await ctx.db.insert("videos", {
        title: "Pending Video",
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
      await ctx.db.insert("videos", {
        title: "Legacy Video",
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const videos = await asOrg.query(api.public.queries.listVideos, {
      orgSlug: "vid-list-org",
    });
    expect(videos).toHaveLength(2);
    const titles = videos.map((v: { title: string }) => v.title);
    expect(titles).toContain("Approved Video");
    expect(titles).toContain("Legacy Video");
    expect(titles).not.toContain("Pending Video");
  });
});
