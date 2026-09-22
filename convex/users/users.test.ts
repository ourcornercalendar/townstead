import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("users", () => {
  describe("upsertUser (internal mutation)", () => {
    it("creates a new user when none exists", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

      const userId = await asOrg.mutation(internal.users.mutations.upsertUser, {
        clerkId: "clerk_123",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
      });

      expect(userId).toBeTruthy();

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      expect(user!.clerkId).toBe("clerk_123");
      expect(user!.email).toBe("jane@example.com");
      expect(user!.firstName).toBe("Jane");
      expect(user!.createdAt).toBeTypeOf("number");
    });

    it("updates existing user instead of creating duplicate", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

      const id1 = await asOrg.mutation(internal.users.mutations.upsertUser, {
        clerkId: "clerk_123",
        email: "old@example.com",
        firstName: "Old",
      });

      const id2 = await asOrg.mutation(internal.users.mutations.upsertUser, {
        clerkId: "clerk_123",
        email: "new@example.com",
        firstName: "New",
      });

      expect(id1).toEqual(id2);

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(id2);
      });
      expect(user!.email).toBe("new@example.com");
      expect(user!.firstName).toBe("New");
    });
  });

  describe("getByClerkId", () => {
    it("returns user by clerk ID", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "clerk_abc",
          email: "abc@test.com",
          firstName: "Alice",
          createdAt: 1000000,
        });
      });

      const user = await asOrg.query(api.users.queries.getByClerkId, {
        clerkId: "clerk_abc",
      });
      expect(user).not.toBeNull();
      expect(user!.email).toBe("abc@test.com");
    });

    it("returns null for unknown clerk ID", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

      const user = await asOrg.query(api.users.queries.getByClerkId, {
        clerkId: "nonexistent",
      });
      expect(user).toBeNull();
    });
  });

  describe("getMe", () => {
    it("returns null when unauthenticated", async () => {
      const t = convexTest(schema, modules);
      const result = await t.query(api.users.queries.getMe, {});
      expect(result).toBeNull();
    });

    it("returns user record for authenticated user", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user_subject_1",
          email: "me@test.com",
          firstName: "Me",
          createdAt: 1000000,
        });
      });

      const authed = t.withIdentity({ subject: "user_subject_1" });
      const result = await authed.query(api.users.queries.getMe, {});
      expect(result).not.toBeNull();
      expect(result!.email).toBe("me@test.com");
    });

    it("returns null when user has no record yet", async () => {
      const t = convexTest(schema, modules);
      const authed = t.withIdentity({ subject: "no_record" });
      const result = await authed.query(api.users.queries.getMe, {});
      expect(result).toBeNull();
    });
  });

  describe("updateProfile", () => {
    it("rejects unauthenticated calls", async () => {
      const t = convexTest(schema, modules);
      await expect(
        t.mutation(api.users.mutations.updateProfile, { firstName: "New" })
      ).rejects.toThrowError("Not authenticated");
    });

    it("updates profile fields", async () => {
      const t = convexTest(schema, modules);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "user_subject_2",
          email: "profile@test.com",
          firstName: "Old",
          lastName: "Name",
          createdAt: 1000000,
        });
      });

      const authed = t.withIdentity({ subject: "user_subject_2" });
      await authed.mutation(api.users.mutations.updateProfile, {
        firstName: "New",
        lastName: "Updated",
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      expect(updated!.firstName).toBe("New");
      expect(updated!.lastName).toBe("Updated");
    });

    it("throws when user record does not exist", async () => {
      const t = convexTest(schema, modules);
      const authed = t.withIdentity({ subject: "ghost_user" });
      await expect(
        authed.mutation(api.users.mutations.updateProfile, { firstName: "X" })
      ).rejects.toThrowError("User record not found");
    });
  });
});
