import { query } from "../_generated/server";
import { v } from "convex/values";
import { isOwnDoc, requireWorkspace } from "../auth.helpers";

export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    // Readable by a helper working on the calendar too: the event form needs
    // these names to offer them, and they are labels, not business data.
    await requireWorkspace(ctx, args.orgId);
    const editions = await ctx.db
      .query("calendarEditions")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
    return editions.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const getById = query({
  args: { id: v.id("calendarEditions") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    return await ctx.db.get(args.id);
  },
});
