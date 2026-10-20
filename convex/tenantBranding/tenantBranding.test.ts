import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("tenantBranding", () => {
  it("tenant isolation — getByOrgId returns null for non-existent org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_b",
        orgSlug: "org-b",
        siteName: "Org B Site",
      });
    });

    const result = await t.query(api.tenantBranding.queries.getByOrgId, {
      orgId: "org_a",
    });
    expect(result).toBeNull();
  });

  it("upsert creates new branding then updates on second call", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const id1 = await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "org-one",
      siteName: "My Calendar",
      primaryColor: "#FF0000",
    });
    expect(id1).toBeTruthy();

    const created = await t.query(api.tenantBranding.queries.getByOrgId, {
      orgId: "org_1",
    });
    expect(created).not.toBeNull();
    expect(created!.siteName).toBe("My Calendar");
    expect(created!.primaryColor).toBe("#FF0000");

    const id2 = await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "org-one",
      siteName: "Updated Calendar",
      primaryColor: "#00FF00",
    });
    expect(id2).toBe(id1);

    const updated = await t.query(api.tenantBranding.queries.getByOrgId, {
      orgId: "org_1",
    });
    expect(updated!.siteName).toBe("Updated Calendar");
    expect(updated!.primaryColor).toBe("#00FF00");
  });

  it("getBySlug returns branding by orgSlug", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "my-community",
      siteName: "Community Site",
      tagline: "Welcome!",
    });

    const result = await t.query(api.tenantBranding.queries.getBySlug, {
      orgSlug: "my-community",
    });
    expect(result).not.toBeNull();
    expect(result!.siteName).toBe("Community Site");
    expect(result!.tagline).toBe("Welcome!");
  });

  it("getBySlug returns null for unknown slug", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const result = await t.query(api.tenantBranding.queries.getBySlug, {
      orgSlug: "nonexistent",
    });
    expect(result).toBeNull();
  });

  it("getBySlug returns resolved logoUrl and heroImageUrl as null when not set", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "url-test",
      siteName: "URL Test Site",
    });

    const result = await t.query(api.tenantBranding.queries.getBySlug, {
      orgSlug: "url-test",
    });
    expect(result).not.toBeNull();
    expect(result!.logoUrl).toBeNull();
    expect(result!.heroImageUrl).toBeNull();
  });

  it("getByOrgId returns resolved logoUrl and heroImageUrl as null when not set", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "orgid-test",
      siteName: "OrgId Test Site",
    });

    const result = await t.query(api.tenantBranding.queries.getByOrgId, {
      orgId: "org_1",
    });
    expect(result).not.toBeNull();
    expect(result!.logoUrl).toBeNull();
    expect(result!.heroImageUrl).toBeNull();
  });

  it("upsert persists heroImage field", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["fake-image"], { type: "image/png" }));
    });

    await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "hero-test",
      siteName: "Hero Test",
      heroImage: storageId,
    });

    const result = await t.query(api.tenantBranding.queries.getBySlug, {
      orgSlug: "hero-test",
    });
    expect(result).not.toBeNull();
    expect(result!.heroImage).toBe(storageId);
    expect(result!.heroImageUrl).not.toBeNull();
    expect(typeof result!.heroImageUrl).toBe("string");
  });

  it("upsert saves socialLinks correctly", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(api.tenantBranding.mutations.upsert, {
      orgId: "org_1",
      orgSlug: "social-org",
      socialLinks: {
        facebook: "https://fb.com/test",
        instagram: "https://ig.com/test",
      },
    });

    const result = await t.query(api.tenantBranding.queries.getByOrgId, {
      orgId: "org_1",
    });
    expect(result!.socialLinks?.facebook).toBe("https://fb.com/test");
    expect(result!.socialLinks?.instagram).toBe("https://ig.com/test");
  });
});
