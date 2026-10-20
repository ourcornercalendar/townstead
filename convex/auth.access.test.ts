import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * The doors that were standing open.
 *
 * A Convex `query` or `mutation` is a public endpoint. The deployment URL ships
 * inside the client bundle, so anything that does not check the caller's
 * identity can be called by anyone who opens the site — passing whatever orgId
 * they like. Eighty-seven functions were in that state, including the whole of
 * contacts, purchases, payments and billing. The only thing standing in front
 * of them was an admin screen that declined to render, which is not a lock.
 *
 * These tests exist so that if someone later adds a handler without a guard,
 * or removes one, a test says so rather than nobody noticing for a year.
 */

const ORG = "org_1";
const OTHER = "org_2";

describe("unauthenticated callers are refused", () => {
  it("cannot list contacts", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.contacts.queries.list, { orgId: ORG })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot search contacts", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.contacts.queries.search, { orgId: ORG, searchTerm: "a" })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot list purchases", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.purchases.queries.list, { orgId: ORG, now: Date.now() })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot read the org's settings", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.settings.queries.getOrgSettings, { orgId: ORG })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot create a contact", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.contacts.mutations.create, {
        orgId: ORG,
        company: "Intruder Ltd",
        firstName: "No",
        lastName: "Entry",
      })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot ask for a file upload URL", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.contacts.mutations.generateUploadUrl, {})
    ).rejects.toThrow(/Not authenticated/);
  });
});

describe("a signed-in user cannot reach another organisation", () => {
  it("is refused when asking for another org's contacts", async () => {
    const t = convexTest(schema, modules).withIdentity({
      subject: "user_1",
      orgId: ORG,
    });
    await expect(
      t.query(api.contacts.queries.list, { orgId: OTHER })
    ).rejects.toThrow(/Not authorized for this organization/);
  });

  it("is refused when writing into another org", async () => {
    const t = convexTest(schema, modules).withIdentity({
      subject: "user_1",
      orgId: ORG,
    });
    await expect(
      t.mutation(api.contacts.mutations.create, {
        orgId: OTHER,
        company: "Wrong Org Co",
        firstName: "A",
        lastName: "B",
      })
    ).rejects.toThrow(/Not authorized for this organization/);
  });

  it("cannot read another org's contact by its id", async () => {
    const base = convexTest(schema, modules);
    const asOther = base.withIdentity({ subject: "user_2", orgId: OTHER });
    const id = await asOther.mutation(api.contacts.mutations.create, {
      orgId: OTHER,
      company: "Theirs",
      firstName: "Not",
      lastName: "Yours",
    });

    // Knowing the id is not permission to read it. This used to return the
    // record: the handler asked for an id and nothing else.
    const asUs = base.withIdentity({ subject: "user_1", orgId: ORG });
    const got = await asUs.query(api.contacts.queries.getById, { id });
    expect(got).toBeNull();
  });

  it("still returns a record to its own organisation", async () => {
    const base = convexTest(schema, modules);
    const asUs = base.withIdentity({ subject: "user_1", orgId: ORG });
    const id = await asUs.mutation(api.contacts.mutations.create, {
      orgId: ORG,
      company: "Ours",
      firstName: "Quite",
      lastName: "Fine",
    });
    const got = await asUs.query(api.contacts.queries.getById, { id });
    expect(got).not.toBeNull();
    expect(got!.company).toBe("Ours");
  });
});

describe("the public site still works without a login", () => {
  it("serves branding by slug to anyone", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: ORG,
        orgSlug: "ourcorner",
        siteName: "Our Corner",
      });
    });
    // No identity. This is the front of the public website and must stay open.
    const branding = await t.query(api.tenantBranding.queries.getBySlug, {
      orgSlug: "ourcorner",
    });
    expect(branding).not.toBeNull();
    expect(branding!.siteName).toBe("Our Corner");
  });
});
