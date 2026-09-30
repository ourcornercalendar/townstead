import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrg, isOwnDoc } from "../auth.helpers";
import { sortAdvertisements } from "./order";

export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const ads = await ctx.db
      .query("advertisements")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
    // Sorted here rather than on the page, so every screen that lists
    // advertisements -- the purchase wizard, the print picker -- shows them
    // in the same order Joyce arranged.
    return sortAdvertisements(ads);
  },
});

export const getById = query({
  args: { id: v.id("advertisements") },
  handler: async (ctx, args) => {
    // Looking a record up by id alone crosses org boundaries: the id is the
    // only thing asked for, so any id works. Anything not ours reads as
    // empty, which is what a missing record already looked like.
    if (!(await isOwnDoc(ctx, await ctx.db.get(args.id)))) return null;
    return await ctx.db.get(args.id);
  },
});
