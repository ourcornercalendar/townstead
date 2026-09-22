import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth.helpers";

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // The users table is not org-scoped -- it holds the Clerk identity itself
    // (name, email, clerk id), with org membership living in orgPermissions.
    // So there is no owning org to compare against here; requiring a signed-in
    // org member is the check that applies.
    await requireAuth(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});
