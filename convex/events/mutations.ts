import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import {
  requireAuth,
  requireOwnDoc,
  requireOrgMemberPermission,
  requireWorkspace,
  requireWorkspacePermission,
  checkCreateAction,
  resolveEffectivePermissions,
} from "../auth.helpers";
import { Doc } from "../_generated/dataModel";
import {
  PERMISSIONS,
  canEditAnyEvent,
  canDeleteAnyEvent,
} from "../permissions";


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

  // Anyone else's event: needs the "any" permission for this action, or the
  // older `manage_all` which means both.
  const any =
    action === "update"
      ? canEditAnyEvent(permissions)
      : canDeleteAnyEvent(permissions);
  if (any) return;

  const own = event.submittedBy === userId;
  const needed =
    action === "update"
      ? PERMISSIONS.EVENTS_UPDATE_OWN
      : PERMISSIONS.EVENTS_DELETE_OWN;
  if (own && permissions.includes(needed)) return;

  // Name the permission that was actually missing. "Permission denied:
  // events:manage_all" was the message whatever the cause, which told
  // whoever read the logs nothing about which switch to turn on.
  throw new Error(
    `Permission denied: ${
      own
        ? needed
        : action === "update"
          ? PERMISSIONS.EVENTS_UPDATE_ANY
          : PERMISSIONS.EVENTS_DELETE_ANY
    }`
  );
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
    // The category this event is filed under — "CSD", "School District" and
    // so on, which the owner creates herself in Admin -> Categories.
    //
    // `categoryId` has been in the events schema all along, but no mutation
    // ever accepted it and the admin form never offered it, so no event could
    // ever have one. That is also why the category buttons on the public
    // events page matched nothing: they filtered on a field that was always
    // empty.
    //
    // Nullable, not merely optional, and the two mean different things:
    //   absent  -> leave whatever is there alone
    //   null    -> clear it ("No category" in the form)
    //   an id   -> file it under that category
    // See the note in `update`, where the distinction actually bites.
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
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
    // null is the form's way of saying "no category"; the stored shape for
    // that is simply an absent field.
    const { categoryId, ...rest } = args;
    return await ctx.db.insert("events", {
      ...rest,
      categoryId: categoryId ?? undefined,

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
    // Nullable on purpose, and this is where it matters.
    //
    // Convex does remove a field when you patch it to undefined — but an
    // argument you pass as `undefined` never arrives at all, so it is spread
    // out of existence and the patch leaves the old value in place. Declaring
    // it `v.optional(v.id(...))` and sending undefined therefore makes "No
    // category" quietly do nothing: the form closes, the toast says saved,
    // and the event is still filed where it was.
    //
    // A test caught exactly that. null is the explicit "clear it" signal, and
    // the handler below turns it into the undefined that patch understands.
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    imageFileId: v.optional(v.id("_storage")),
    isApproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, await ctx.db.get(args.id), "update");
    const { id, categoryId, ...fields } = args;
    await ctx.db.patch(id, {
      ...fields,
      // Absent stays absent (leave it alone); null becomes undefined, which
      // is what actually removes the field.
      ...(categoryId !== undefined
        ? { categoryId: categoryId ?? undefined }
        : {}),
    });
  },
});

/**
 * Who may approve or reject one particular event.
 *
 * `requireWorkspacePermission` rather than `requireAuth`: approving used to be
 * organisation-members-only, so the permission existed but could never be
 * handed to a helper. A member with no grant is still treated as running the
 * organisation, and one holding a limited grant is still held to it.
 *
 * The event has to be read before the check, because the check needs its
 * orgId -- and that is the trap. Reporting the refusal verbatim would tell a
 * caller from another organisation that this id exists, which is exactly what
 * the old code's flat "Not found" withheld. So a refusal to stand in the
 * workspace at all is reported as "Not found"; a caller who does belong there
 * but lacks the switch still gets the permission name, which is what tells
 * the owner which toggle to turn on.
 */
async function requireApproval(
  ctx: MutationCtx,
  orgId: string
): Promise<void> {
  try {
    await requireWorkspacePermission(ctx, orgId, PERMISSIONS.EVENTS_APPROVE);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "Not authorized for this organization"
    ) {
      throw new Error("Not found");
    }
    throw err;
  }
}

export const approve = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Not found");
    await requireApproval(ctx, event.orgId);

    await ctx.db.patch(args.id, { isApproved: true });
  },
});

export const reject = mutation({
  args: {
    id: v.id("events"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // See `requireApproval` above.
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Not found");
    await requireApproval(ctx, event.orgId);

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
