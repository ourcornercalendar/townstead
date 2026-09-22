import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requirePermission } from "../auth.helpers";
import { PERMISSIONS } from "../permissions";

export const create = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    featuredImageFileId: v.optional(v.id("_storage")),
    authorId: v.optional(v.string()),
    categoryIds: v.optional(v.array(v.id("categories"))),
    communityIds: v.optional(v.array(v.id("communities"))),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("published")
    ),
    publishedAt: v.optional(v.number()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    return await ctx.db.insert("blogPosts", {
      ...args,
      orgId,
      isDeleted: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("blogPosts"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    featuredImageFileId: v.optional(v.id("_storage")),
    authorId: v.optional(v.string()),
    categoryIds: v.optional(v.array(v.id("categories"))),
    communityIds: v.optional(v.array(v.id("communities"))),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending"),
        v.literal("published")
      )
    ),
    publishedAt: v.optional(v.number()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== orgId) throw new Error("Not found");

    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const approve = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);
    await requirePermission(ctx, userId, orgId, PERMISSIONS.BLOG_APPROVE);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== orgId) throw new Error("Not found");

    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
    });
  },
});

export const reject = mutation({
  args: {
    id: v.id("blogPosts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);
    await requirePermission(ctx, userId, orgId, PERMISSIONS.BLOG_APPROVE);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== orgId) throw new Error("Not found");

    await ctx.db.patch(args.id, { status: "draft" });
  },
});

export const softDelete = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== orgId) throw new Error("Not found");

    await ctx.db.patch(args.id, { isDeleted: true });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
