import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * One owner, two shops.
 *
 * The email check used to refuse any second contact sharing an address, which
 * made an ordinary case impossible: the same person owns two Beach Hut Delis
 * at two locations, and both bill to the same email. Joyce could enter the
 * first and was then stuck on the second, with an error that read as if she
 * had made a mistake.
 */

const owner = {
  orgId: "org_1",
  firstName: "Sam",
  lastName: "Reyes",
  email: "sam@beachhutdeli.example",
};

describe("one owner with more than one business", () => {
  it("lets a second location share the owner's email", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.contacts.mutations.create, {
      ...owner,
      company: "Beach Hut Deli - West Sacramento",
    });

    // This is the save that used to fail.
    const second = await t.mutation(api.contacts.mutations.create, {
      ...owner,
      company: "Beach Hut Deli - Elk Grove",
    });

    expect(second).toBeDefined();
    const all = await t.run(async (ctx) => ctx.db.query("contacts").collect());
    expect(all).toHaveLength(2);
    expect(all.every((c) => c.email === owner.email)).toBe(true);
  });

  it("holds as many locations as the owner actually has", async () => {
    const t = convexTest(schema, modules);
    for (const where of ["West Sacramento", "Elk Grove", "Davis", "Folsom"]) {
      await t.mutation(api.contacts.mutations.create, {
        ...owner,
        company: `Beach Hut Deli - ${where}`,
      });
    }
    const all = await t.run(async (ctx) => ctx.db.query("contacts").collect());
    expect(all).toHaveLength(4);
  });

  it("still refuses the same business entered twice", async () => {
    // The mistake the check was originally for. Same company, same email.
    const t = convexTest(schema, modules);
    await t.mutation(api.contacts.mutations.create, { ...owner, company: "Beach Hut Deli" });

    await expect(
      t.mutation(api.contacts.mutations.create, { ...owner, company: "Beach Hut Deli" })
    ).rejects.toThrow(/already exists/);
  });

  it("treats casing and stray spaces as the same name", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.contacts.mutations.create, { ...owner, company: "Beach Hut Deli" });

    await expect(
      t.mutation(api.contacts.mutations.create, { ...owner, company: "  beach hut deli " })
    ).rejects.toThrow(/already exists/);
  });

  it("says what to do about it, not just that it failed", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.contacts.mutations.create, { ...owner, company: "Beach Hut Deli" });

    await expect(
      t.mutation(api.contacts.mutations.create, { ...owner, company: "Beach Hut Deli" })
    ).rejects.toThrow(/second location/);
  });

  it("lets a rename keep the shared email", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.contacts.mutations.create, {
      ...owner,
      company: "Beach Hut Deli - West Sacramento",
    });
    await t.mutation(api.contacts.mutations.create, {
      ...owner,
      company: "Beach Hut Deli - Elk Grove",
    });

    const { orgId: _org, ...person } = owner;
    await t.mutation(api.contacts.mutations.update, {
      id: first,
      ...person,
      company: "Beach Hut Deli - Riverfront",
    });

    const renamed = await t.run(async (ctx) => ctx.db.get(first));
    expect(renamed!.company).toBe("Beach Hut Deli - Riverfront");
  });

  it("stops a rename that would collide with a sibling", async () => {
    // Renaming West Sacramento to "Elk Grove" would make two identical
    // advertisers, which is the thing worth refusing.
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.contacts.mutations.create, {
      ...owner,
      company: "Beach Hut Deli - West Sacramento",
    });
    await t.mutation(api.contacts.mutations.create, {
      ...owner,
      company: "Beach Hut Deli - Elk Grove",
    });

    const { orgId: _org, ...person } = owner;
    await expect(
      t.mutation(api.contacts.mutations.update, {
        id: first,
        ...person,
        company: "Beach Hut Deli - Elk Grove",
      })
    ).rejects.toThrow(/already exists/);
  });

  it("still lets a business be saved with no email at all", async () => {
    const t = convexTest(schema, modules);
    const a = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1", company: "Corner Florist", firstName: "Ann", lastName: "Lee",
    });
    const b = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1", company: "Corner Florist", firstName: "Ann", lastName: "Lee",
    });
    expect(a).not.toEqual(b);
  });

  it("keeps publishers apart", async () => {
    // The same email in another org is not this org's business.
    const t = convexTest(schema, modules);
    await t.mutation(api.contacts.mutations.create, { ...owner, company: "Beach Hut Deli" });
    const other = await t.mutation(api.contacts.mutations.create, {
      ...owner, orgId: "org_2", company: "Beach Hut Deli",
    });
    expect(other).toBeDefined();
  });
});
