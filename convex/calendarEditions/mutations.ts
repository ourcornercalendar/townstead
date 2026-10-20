import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, requireOwnDoc } from "../auth.helpers";

export const create = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    code: v.string(),
    communityId: v.optional(v.id("communities")),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const existing = await ctx.db
      .query("calendarEditions")
      .withIndex("by_orgId_and_code", (q) =>
        q.eq("orgId", args.orgId).eq("code", args.code)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .first();
    if (existing) {
      throw new Error(`A calendar edition with code "${args.code}" already exists`);
    }

    const editionId = await ctx.db.insert("calendarEditions", {
      name: args.name,
      code: args.code,
      orgId: args.orgId,
      isDeleted: false,
    });

    if (args.communityId) {
      const community = await ctx.db.get(args.communityId);
      if (!community || community.orgId !== args.orgId) {
        throw new Error("Community not found");
      }
      await ctx.db.patch(args.communityId, {
        calendarEditionIds: [...community.calendarEditionIds, editionId],
      });
    }

    return editionId;
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarEditions"),
    name: v.string(),
    code: v.string(),
    communityId: v.optional(v.id("communities")),
    removeCommunity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Calendar edition not found");
    if (args.code !== current.code) {
      const existing = await ctx.db
        .query("calendarEditions")
        .withIndex("by_orgId_and_code", (q) =>
          q.eq("orgId", current.orgId).eq("code", args.code)
        )
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .first();
      if (existing && existing._id !== args.id) {
        throw new Error(`A calendar edition with code "${args.code}" already exists`);
      }
    }
    await ctx.db.patch(args.id, { name: args.name, code: args.code });

    if (args.communityId || args.removeCommunity) {
      const allCommunities = await ctx.db
        .query("communities")
        .withIndex("by_orgId", (q) => q.eq("orgId", current.orgId))
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .collect();

      for (const community of allCommunities) {
        if (community.calendarEditionIds.includes(args.id)) {
          await ctx.db.patch(community._id, {
            calendarEditionIds: community.calendarEditionIds.filter(
              (id) => id !== args.id
            ),
          });
        }
      }

      if (args.communityId) {
        const target = await ctx.db.get(args.communityId);
        if (!target || target.orgId !== current.orgId) {
          throw new Error("Community not found");
        }
        await ctx.db.patch(args.communityId, {
          calendarEditionIds: [...target.calendarEditionIds.filter(
            (id) => id !== args.id
          ), args.id],
        });
      }
    }
  },
});

export const softDelete = mutation({
  args: { id: v.id("calendarEditions") },
  handler: async (ctx, args) => {
    // Loading by id alone crosses org boundaries: the id is the only thing
    // asked for, so any id works. This refuses anything not ours.
    await requireOwnDoc(ctx, await ctx.db.get(args.id));
    await ctx.db.patch(args.id, { isDeleted: true });
  },
});
