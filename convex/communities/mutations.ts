import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth.helpers";

const RESERVED_SLUGS = new Set([
  "events", "directory", "coupons", "blog", "videos", "profile",
  "admin", "portal", "auth", "api", "_next", "c",
]);

function validateSlug(slug: string) {
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(
      `"${slug}" is a reserved name and cannot be used as a community slug`,
    );
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageFileId: v.optional(v.id("_storage")),
    calendarEditionIds: v.array(v.id("calendarEditions")),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    validateSlug(args.slug);

    const existing = await ctx.db
      .query("communities")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", orgId).eq("slug", args.slug)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .unique();

    if (existing) throw new Error("A community with this slug already exists");

    return await ctx.db.insert("communities", {
      ...args,
      orgId,
      isDeleted: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("communities"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageFileId: v.optional(v.id("_storage")),
    calendarEditionIds: v.optional(v.array(v.id("calendarEditions"))),
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

    if (updates.slug && updates.slug !== doc.slug) {
      validateSlug(updates.slug as string);
      const existing = await ctx.db
        .query("communities")
        .withIndex("by_orgId_and_slug", (q) =>
          q.eq("orgId", orgId).eq("slug", updates.slug as string)
        )
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .unique();
      if (existing && existing._id !== id)
        throw new Error("A community with this slug already exists");
    }

    await ctx.db.patch(id, updates);
  },
});

export const softDelete = mutation({
  args: { id: v.id("communities") },
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
