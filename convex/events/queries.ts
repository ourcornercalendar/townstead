import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  isOwnDoc,
  requireOrg,
  requireWorkspace,
  resolveEffectivePermissions,
} from "../auth.helpers";
import { PERMISSIONS } from "../permissions";

export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const { userId, isOrgMember } = await requireWorkspace(ctx, args.orgId);

    const events = await ctx.db
      .query("events")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    if (isOrgMember) return events;

    // A helper sees the whole calendar only if they were given
    // `events:manage_all`. Without it they see what they put in, which is
    // enough to correct their own typo and nothing more.
    const { permissions } = await resolveEffectivePermissions(
      ctx,
      userId,
      args.orgId
    );
    if (permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL)) return events;
    return events.filter((e) => e.submittedBy === userId);
  },
});

export const getById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    return await ctx.db.get(args.id);
  },
});

export const listByDateRange = query({
  args: {
    orgId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    return await ctx.db
      .query("events")
      .withIndex("by_orgId_and_date", (q) =>
        q.eq("orgId", args.orgId).gte("date", args.startDate).lte("date", args.endDate)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
  },
});
