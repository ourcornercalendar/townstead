import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requirePermission } from "../auth.helpers";
import { PERMISSIONS } from "../permissions";

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
    return await ctx.db.insert("events", {
      ...args,
      isApproved: true,
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
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const approve = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);
    await requirePermission(ctx, userId, orgId, PERMISSIONS.EVENTS_APPROVE);

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
    await requirePermission(ctx, userId, orgId, PERMISSIONS.EVENTS_APPROVE);

    const event = await ctx.db.get(args.id);
    if (!event || event.orgId !== orgId) throw new Error("Not found");

    await ctx.db.patch(args.id, { isDeleted: true });
  },
});

export const softDelete = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isDeleted: true });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
