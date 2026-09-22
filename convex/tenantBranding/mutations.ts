import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireOrg } from "../auth.helpers";

const RESERVED_SLUGS = new Set([
  "admin", "portal", "auth", "api", "_next", "sitemap", "robots",
]);

export const upsert = mutation({
  args: {
    orgId: v.string(),
    orgSlug: v.string(),
    logo: v.optional(v.id("_storage")),
    heroImage: v.optional(v.id("_storage")),
    primaryColor: v.optional(v.string()),
    siteName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    socialLinks: v.optional(
      v.object({
        facebook: v.optional(v.string()),
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        youtube: v.optional(v.string()),
      })
    ),
    footerText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const existing = await ctx.db
      .query("tenantBranding")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .unique();

    if (RESERVED_SLUGS.has(args.orgSlug)) {
      throw new Error(`"${args.orgSlug}" is a reserved URL and cannot be used as a site slug.`);
    }

    if (existing?.orgSlug !== args.orgSlug) {
      const slugOwner = await ctx.db
        .query("tenantBranding")
        .withIndex("by_orgSlug", (q) => q.eq("orgSlug", args.orgSlug))
        .unique();
      if (slugOwner && slugOwner.orgId !== args.orgId) {
        throw new Error(`The slug "${args.orgSlug}" is already in use by another organization.`);
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        orgSlug: args.orgSlug,
        logo: args.logo,
        heroImage: args.heroImage,
        primaryColor: args.primaryColor,
        siteName: args.siteName,
        tagline: args.tagline,
        socialLinks: args.socialLinks,
        footerText: args.footerText,
      });
      return existing._id;
    }

    return await ctx.db.insert("tenantBranding", {
      orgId: args.orgId,
      orgSlug: args.orgSlug,
      logo: args.logo,
      heroImage: args.heroImage,
      primaryColor: args.primaryColor,
      siteName: args.siteName,
      tagline: args.tagline,
      socialLinks: args.socialLinks,
      footerText: args.footerText,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
