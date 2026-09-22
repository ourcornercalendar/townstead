import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import {
  requireAuth,
  requireOwnDoc,
  requireOrgMemberPermission,
  requireWorkspace,
  checkCreateAction,
  resolveEffectivePermissions,
} from "../auth.helpers";
import { Doc } from "../_generated/dataModel";
import { PERMISSIONS } from "../permissions";


/**
 * Who may change one particular event.
 *
 * An organisation member may change any event of theirs, as before. Someone
 * here on a team grant may change any event only with `events:manage_all`, and
 * otherwise only the ones they added themselves.
 *
 * A missing event falls through untouched, so the handler's own behaviour for
 * "not there" is unchanged.
 */
async function requireEventAccess(
  ctx: MutationCtx,
  event: Doc<"events"> | null,
  action: "update" | "delete"
): Promise<void> {
  if (!event) {
    await requireOwnDoc(ctx, event);
    return;
  }

  const { userId, isOrgMember } = await requireWorkspace(ctx, event.orgId);
  if (isOrgMember) {
    await requireOrgMemberPermission(
      ctx,
      userId,
      event.orgId,
      action === "update"
        ? PERMISSIONS.EVENTS_UPDATE_OWN
        : PERMISSIONS.EVENTS_DELETE_OWN
    );
    return;
  }

  const { permissions } = await resolveEffectivePermissions(
    ctx,
    userId,
    event.orgId
  );
  if (permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL)) return;

  const own = event.submittedBy === userId;
  const needed =
    action === "update"
      ? PERMISSIONS.EVENTS_UPDATE_OWN
      : PERMISSIONS.EVENTS_DELETE_OWN;
  if (own && permissions.includes(needed)) return;

  throw new Error(`Permission denied: ${PERMISSIONS.EVENTS_MANAGE_ALL}`);
}

export const create = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    endDate: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isYearly: v.optional(v.boolean()),
    scheduleType: v.optional(
      v.union(
        v.literal("SINGLE_DAY"),
        v.literal("DAILY_RANGE"),
        v.literal("MONTHLY_DAY"),
        v.literal("MONTHLY_ORDINAL_WEEKDAY")
      )
    ),
    startsOn: v.optional(v.number()),
    endsOn: v.optional(v.number()),
    monthlyOrdinal: v.optional(
      v.union(
        v.literal("EVERY"),
        v.literal("EVERY_OTHER"),
        v.literal("SECOND_AND_FOURTH"),
        v.literal("FIRST_THIRD_AND_FIFTH"),
        v.literal("FIRST"),
        v.literal("SECOND"),
        v.literal("THIRD"),
        v.literal("FOURTH"),
        v.literal("LAST")
      )
    ),
    monthlyWeekday: v.optional(
      v.union(
        v.literal("MONDAY"),
        v.literal("TUESDAY"),
        v.literal("WEDNESDAY"),
        v.literal("THURSDAY"),
        v.literal("FRIDAY"),
        v.literal("SATURDAY"),
        v.literal("SUNDAY")
      )
    ),
    monthlyMonthSelector: v.optional(
      v.union(v.literal("EVERY"), v.literal("EVEN"), v.literal("ODD"))
    ),
    calendarEditionIds: v.optional(v.array(v.id("calendarEditions"))),
    printPlacement: v.optional(
      v.union(v.literal("TOP"), v.literal("MIDDLE"), v.literal("BOTTOM"))
    ),
    isScusd: v.optional(v.boolean()),
    imageFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { userId, isOrgMember } = await requireWorkspace(ctx, args.orgId);

    // Someone here on a team grant is held to the tier they were given:
    // "events:create" publishes straight away, "events:submit" waits for
    // approval. An organisation member is publishing their own calendar, so
    // nothing waits.
    let isApproved = true;
    if (!isOrgMember) {
      const action = await checkCreateAction(ctx, userId, args.orgId, "events");
      if (!action.allowed) {
        throw new Error("Permission denied: events:create");
      }
      isApproved = !action.needsApproval;
    }

    return await ctx.db.insert("events", {
      ...args,
      isApproved,
      submittedBy: userId,
      isDeleted: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    name: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    endDate: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isYearly: v.optional(v.boolean()),
    scheduleType: v.optional(
      v.union(
        v.literal("SINGLE_DAY"),
        v.literal("DAILY_RANGE"),
        v.literal("MONTHLY_DAY"),
        v.literal("MONTHLY_ORDINAL_WEEKDAY")
      )
    ),
    startsOn: v.optional(v.number()),
    endsOn: v.optional(v.number()),
    monthlyOrdinal: v.optional(
      v.union(
        v.literal("EVERY"),
        v.literal("EVERY_OTHER"),
        v.literal("SECOND_AND_FOURTH"),
        v.literal("FIRST_THIRD_AND_FIFTH"),
        v.literal("FIRST"),
        v.literal("SECOND"),
        v.literal("THIRD"),
        v.literal("FOURTH"),
        v.literal("LAST")
      )
    ),
    monthlyWeekday: v.optional(
      v.union(
        v.literal("MONDAY"),
        v.literal("TUESDAY"),
        v.literal("WEDNESDAY"),
        v.literal("THURSDAY"),
        v.literal("FRIDAY"),
        v.literal("SATURDAY"),
        v.literal("SUNDAY")
      )
    ),
    monthlyMonthSelector: v.optional(
      v.union(v.literal("EVERY"), v.literal("EVEN"), v.literal("ODD"))
    ),
    calendarEditionIds: v.optional(v.array(v.id("calendarEditions"))),
    printPlacement: v.optional(
      v.union(v.literal("TOP"), v.literal("MIDDLE"), v.literal("BOTTOM"))
    ),
    isScusd: v.optional(v.boolean()),
    imageFileId: v.optional(v.id("_storage")),
    isApproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, await ctx.db.get(args.id), "update");
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const approve = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);
    await requireOrgMemberPermission(ctx, userId, orgId, PERMISSIONS.EVENTS_APPROVE);

    const event = await ctx.db.get(args.id);
    if (!event || event.orgId !== orgId) throw new Error("Not found");

    await ctx.db.patch(args.id, { isApproved: true });
  },
});

export const reject = mutation({
  args: {
    id: v.id("events"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);
    await requireOrgMemberPermission(ctx, userId, orgId, PERMISSIONS.EVENTS_APPROVE);

    const event = await ctx.db.get(args.id);
    if (!event || event.orgId !== orgId) throw new Error("Not found");

    await ctx.db.patch(args.id, { isDeleted: true });
  },
});

export const softDelete = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, await ctx.db.get(args.id), "delete");
    await ctx.db.patch(args.id, { isDeleted: true });
  },
});

export const generateUploadUrl = mutation({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // orgId is optional so the admin screens, which have always called this
    // with no arguments, keep working unchanged. A team member has no Clerk
    // organisation, so they pass theirs and are checked against it.
    if (args.orgId) {
      await requireWorkspace(ctx, args.orgId);
    } else {
      await requireAuth(ctx);
    }
    return await ctx.storage.generateUploadUrl();
  },
});
