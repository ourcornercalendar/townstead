import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS } from "../permissions";

const _factory = () => convexTest(schema, modules);
type TestInstance = ReturnType<typeof _factory>;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function seedContact(
  t: TestInstance,
  orgId: string,
  overrides: Partial<{ firstName: string; lastName: string; company: string; email: string }> = {}
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("contacts", {
      company: overrides.company ?? "Test Corp",
      firstName: overrides.firstName ?? "Jane",
      lastName: overrides.lastName ?? "Doe",
      email: overrides.email,
      orgId,
    });
  });
}

describe("portalInvites", () => {
  describe("tenant isolation", () => {
    it("getByContact returns null for invites belonging to a different org", async () => {
      const t = convexTest(schema, modules);

      const contactId = await seedContact(t, "org_b");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_b",
          token: "token_b",
          permissions: [PERMISSIONS.PORTAL_VIEW],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const asOrgA = t.withIdentity({ name: "Admin", orgId: "org_a" });
      const result = await asOrgA.query(api.portalInvites.queries.getByContact, {
        contactId,
      });
      expect(result).toBeNull();
    });

    it("create rejects contacts from a different org", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_b");

      const asOrgA = t.withIdentity({ name: "Admin", orgId: "org_a" });
      await expect(
        asOrgA.mutation(api.portalInvites.mutations.create, {
          contactId,
          permissions: [PERMISSIONS.PORTAL_VIEW],
        })
      ).rejects.toThrowError("Contact not found");
    });

    it("revoke rejects invites from a different org", async () => {
      const t = convexTest(schema, modules);

      const inviteId = await t.run(async (ctx) => {
        const contactId = await ctx.db.insert("contacts", {
          company: "Corp", firstName: "X", lastName: "Y", orgId: "org_b",
        });
        return await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_b",
          token: "tok_b",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const asOrgA = t.withIdentity({ name: "Admin", orgId: "org_a" });
      await expect(
        asOrgA.mutation(api.portalInvites.mutations.revoke, { id: inviteId })
      ).rejects.toThrowError("Invite not found");
    });
  });

  describe("getByContact auth handling", () => {
    it("returns null when unauthenticated", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "auth_test_tok_123456789012345",
          permissions: [PERMISSIONS.PORTAL_VIEW],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const result = await t.query(api.portalInvites.queries.getByContact, {
        contactId,
      });
      expect(result).toBeNull();
    });

    it("returns null when identity has no orgId", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "no_org_tok_12345678901234567",
          permissions: [PERMISSIONS.PORTAL_VIEW],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const noOrg = t.withIdentity({ name: "User" });
      const result = await noOrg.query(api.portalInvites.queries.getByContact, {
        contactId,
      });
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a pending invite and returns a token", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      const token = await asOrg.mutation(api.portalInvites.mutations.create, {
        contactId,
        permissions: [PERMISSIONS.PORTAL_VIEW, PERMISSIONS.PORTAL_ASSETS],
      });

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.length).toBe(32);

      const invite = await asOrg.query(api.portalInvites.queries.getByContact, {
        contactId,
      });
      expect(invite).not.toBeNull();
      expect(invite!.status).toBe("pending");
      expect(invite!.permissions).toContain(PERMISSIONS.PORTAL_VIEW);
      expect(invite!.permissions).toContain(PERMISSIONS.PORTAL_ASSETS);
    });

    it("rejects when contact already has portal access", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("orgPermissions", {
          userId: "user_existing",
          orgId: "org_1",
          role: "contact",
          permissions: [],
          contactId,
          isActive: true,
        });
      });

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      await expect(
        asOrg.mutation(api.portalInvites.mutations.create, {
          contactId,
          permissions: [],
        })
      ).rejects.toThrowError("already has portal access");
    });

    it("rejects duplicate pending invite for same contact", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      await asOrg.mutation(api.portalInvites.mutations.create, {
        contactId,
        permissions: [],
      });

      await expect(
        asOrg.mutation(api.portalInvites.mutations.create, {
          contactId,
          permissions: [],
        })
      ).rejects.toThrowError("pending invite already exists");
    });

    it("allows new invite when previous invite expired", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "old_expired_token",
          permissions: [],
          expiresAt: Date.now() - 1000,
          status: "pending",
          createdAt: Date.now() - THIRTY_DAYS_MS - 1000,
        });
      });

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      const token = await asOrg.mutation(api.portalInvites.mutations.create, {
        contactId,
        permissions: [PERMISSIONS.PORTAL_VIEW],
      });
      expect(token).toBeTruthy();
    });

    it("rejects unauthenticated calls", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await expect(
        t.mutation(api.portalInvites.mutations.create, {
          contactId,
          permissions: [],
        })
      ).rejects.toThrowError("Not authenticated");
    });
  });

  describe("redeem", () => {
    it("creates an orgPermissions grant with the invite's permissions", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");
      const permissions = [PERMISSIONS.PORTAL_VIEW, PERMISSIONS.PORTAL_MESSAGES];

      const token = await t.run(async (ctx) => {
        const tok = "redeem_test_token_12345678901234";
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: tok,
          permissions,
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
        return tok;
      });

      const asClient = t.withIdentity({
        name: "Client",
        subject: "user_client_1",
      });

      const result = await asClient.mutation(api.portalInvites.mutations.redeem, {
        token,
      });
      expect(result.orgId).toBe("org_1");
      expect(result.contactId).toBe(contactId);

      const grant = await t.run(async (ctx) => {
        return await ctx.db
          .query("orgPermissions")
          .withIndex("by_contactId", (q) => q.eq("contactId", contactId))
          .first();
      });
      expect(grant).not.toBeNull();
      expect(grant!.userId).toBe("user_client_1");
      expect(grant!.role).toBe("contact");
      expect(grant!.isActive).toBe(true);
      expect(grant!.permissions).toEqual(permissions);

      const invite = await t.run(async (ctx) => {
        return await ctx.db
          .query("portalInvites")
          .withIndex("by_token", (q) => q.eq("token", token))
          .first();
      });
      expect(invite!.status).toBe("redeemed");
      expect(invite!.redeemedByUserId).toBe("user_client_1");
    });

    it("rejects expired invite", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "expired_tok_1234567890123456",
          permissions: [],
          expiresAt: Date.now() - 1000,
          status: "pending",
          createdAt: Date.now() - THIRTY_DAYS_MS - 1000,
        });
      });

      const asClient = t.withIdentity({
        name: "Client",
        subject: "user_client_1",
      });

      await expect(
        asClient.mutation(api.portalInvites.mutations.redeem, {
          token: "expired_tok_1234567890123456",
        })
      ).rejects.toThrowError("expired");
    });

    it("rejects already-redeemed invite", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "redeemed_tok_12345678901234567",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "redeemed",
          redeemedByUserId: "user_other",
          redeemedAt: Date.now(),
          createdAt: Date.now() - 1000,
        });
      });

      const asClient = t.withIdentity({
        name: "Client",
        subject: "user_client_2",
      });

      await expect(
        asClient.mutation(api.portalInvites.mutations.redeem, {
          token: "redeemed_tok_12345678901234567",
        })
      ).rejects.toThrowError("already been used");
    });

    it("rejects revoked invite", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      await t.run(async (ctx) => {
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "revoked_tok_12345678901234567",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "revoked",
          createdAt: Date.now() - 1000,
        });
      });

      const asClient = t.withIdentity({
        name: "Client",
        subject: "user_client_3",
      });

      await expect(
        asClient.mutation(api.portalInvites.mutations.redeem, {
          token: "revoked_tok_12345678901234567",
        })
      ).rejects.toThrowError("revoked");
    });

    it("rejects invalid token", async () => {
      const t = convexTest(schema, modules);

      const asClient = t.withIdentity({
        name: "Client",
        subject: "user_client_1",
      });

      await expect(
        asClient.mutation(api.portalInvites.mutations.redeem, {
          token: "nonexistent_token",
        })
      ).rejects.toThrowError("Invalid invite link");
    });

    it("rejects when user is already linked to another contact", async () => {
      const t = convexTest(schema, modules);
      const contactId1 = await seedContact(t, "org_1", { firstName: "A" });
      const contactId2 = await seedContact(t, "org_1", { firstName: "B" });

      await t.run(async (ctx) => {
        await ctx.db.insert("orgPermissions", {
          userId: "user_already_linked",
          orgId: "org_1",
          role: "contact",
          permissions: [],
          contactId: contactId1,
          isActive: true,
        });
        await ctx.db.insert("portalInvites", {
          contactId: contactId2,
          orgId: "org_1",
          token: "dup_user_tok_1234567890123456",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const asClient = t.withIdentity({
        name: "Client",
        subject: "user_already_linked",
      });

      await expect(
        asClient.mutation(api.portalInvites.mutations.redeem, {
          token: "dup_user_tok_1234567890123456",
        })
      ).rejects.toThrowError("already linked to another contact");
    });

    it("rejects unauthenticated calls", async () => {
      const t = convexTest(schema, modules);
      await expect(
        t.mutation(api.portalInvites.mutations.redeem, {
          token: "any_token",
        })
      ).rejects.toThrowError("Not authenticated");
    });
  });

  describe("revoke", () => {
    it("marks a pending invite as revoked", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      const inviteId = await t.run(async (ctx) => {
        return await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "revoke_me_tok_123456789012345",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      await asOrg.mutation(api.portalInvites.mutations.revoke, { id: inviteId });

      const invite = await t.run(async (ctx) => ctx.db.get(inviteId));
      expect(invite!.status).toBe("revoked");
    });

    it("rejects revoking a non-pending invite", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      const inviteId = await t.run(async (ctx) => {
        return await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "already_redeemed_123456789012",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "redeemed",
          redeemedByUserId: "user_x",
          redeemedAt: Date.now(),
          createdAt: Date.now() - 1000,
        });
      });

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      await expect(
        asOrg.mutation(api.portalInvites.mutations.revoke, { id: inviteId })
      ).rejects.toThrowError("Can only revoke pending invites");
    });
  });

  describe("resend", () => {
    it("returns the token for a pending invite", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      const inviteId = await t.run(async (ctx) => {
        return await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "resend_me_tok_1234567890123456",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      const token = await asOrg.mutation(api.portalInvites.mutations.resend, {
        id: inviteId,
      });
      expect(token).toBe("resend_me_tok_1234567890123456");
    });

    it("rejects resending an expired invite", async () => {
      const t = convexTest(schema, modules);
      const contactId = await seedContact(t, "org_1");

      const inviteId = await t.run(async (ctx) => {
        return await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "expired_resend_12345678901234567",
          permissions: [],
          expiresAt: Date.now() - 1000,
          status: "pending",
          createdAt: Date.now() - THIRTY_DAYS_MS - 1000,
        });
      });

      const asOrg = t.withIdentity({ name: "Admin", orgId: "org_1" });
      await expect(
        asOrg.mutation(api.portalInvites.mutations.resend, { id: inviteId })
      ).rejects.toThrowError("expired");
    });
  });

  describe("validateToken", () => {
    it("returns valid=true with org info for a valid pending invite", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

      await t.run(async (ctx) => {
        const contactId = await ctx.db.insert("contacts", {
          company: "Acme Publishing",
          firstName: "Jane",
          lastName: "Smith",
          orgId: "org_1",
        });
        await ctx.db.insert("orgSettings", {
          businessName: "Acme Publishing Co",
          orgId: "org_1",
        });
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "valid_token_12345678901234567890",
          permissions: [],
          expiresAt: Date.now() + THIRTY_DAYS_MS,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const result = await asOrg.query(api.portalInvites.queries.validateToken, {
        token: "valid_token_12345678901234567890",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.orgName).toBe("Acme Publishing Co");
        expect(result.contactName).toBe("Jane Smith");
        expect(result.companyName).toBe("Acme Publishing");
      }
    });

    it("returns valid=false for expired invite", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

      await t.run(async (ctx) => {
        const contactId = await ctx.db.insert("contacts", {
          company: "Corp",
          firstName: "A",
          lastName: "B",
          orgId: "org_1",
        });
        await ctx.db.insert("portalInvites", {
          contactId,
          orgId: "org_1",
          token: "expired_validate_tok_12345678901",
          permissions: [],
          expiresAt: Date.now() - 1000,
          status: "pending",
          createdAt: Date.now() - THIRTY_DAYS_MS - 1000,
        });
      });

      const result = await asOrg.query(api.portalInvites.queries.validateToken, {
        token: "expired_validate_tok_12345678901",
      });
      expect(result.valid).toBe(false);
    });

    it("returns valid=false for nonexistent token", async () => {
      const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
      const result = await asOrg.query(api.portalInvites.queries.validateToken, {
        token: "does_not_exist",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Invalid invite link");
      }
    });
  });
});
