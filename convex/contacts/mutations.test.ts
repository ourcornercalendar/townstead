import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("contacts.mutations.create", () => {
  it("inserts a contact with searchText built from fields", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Acme Corp",
      firstName: "Alice",
      lastName: "Wonder",
      email: "alice@acme.com",
    });

    const contact = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(contact).not.toBeNull();
    expect(contact!.searchText).toBe("Acme Corp Alice Wonder alice@acme.com");
    expect(contact!.isDeleted).toBe(false);
    expect(contact!.updatedAt).toBeTypeOf("number");
  });

  it("builds searchText without email when email is omitted", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "No Email Co",
      firstName: "Bob",
      lastName: "Smith",
    });

    const contact = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(contact!.searchText).toBe("No Email Co Bob Smith");
  });

  // The rule used to be one contact per email. That made an ordinary case
  // impossible -- one owner, two shops, one billing address -- so a duplicate
  // now means the same company name as well as the same email. The case that
  // drove the change is in two-locations.test.ts.
  it("rejects the same company entered twice on one email", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "First Co",
      firstName: "A",
      lastName: "B",
      email: "dupe@test.com",
    });

    await expect(
      t.mutation(api.contacts.mutations.create, {
        orgId: "org_1",
        company: "First Co",
        firstName: "C",
        lastName: "D",
        email: "dupe@test.com",
      })
    ).rejects.toThrowError(/already exists with the email "dupe@test.com"/);
  });

  it("allows a different company on the same email", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "First Co",
      firstName: "A",
      lastName: "B",
      email: "dupe@test.com",
    });

    const second = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Second Co",
      firstName: "C",
      lastName: "D",
      email: "dupe@test.com",
    });

    expect(second).toBeDefined();
  });

  it("allows the same email in different orgs", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.contacts.mutations.create, {
      orgId: "org_a",
      company: "Org A Co",
      firstName: "A",
      lastName: "One",
      email: "shared@test.com",
    });

    const id = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_b",
      company: "Org B Co",
      firstName: "B",
      lastName: "Two",
      email: "shared@test.com",
    });

    expect(id).toBeTruthy();
  });

  it("allows creating a contact without an email (no uniqueness check)", async () => {
    const t = convexTest(schema, modules);

    const id1 = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1", company: "A", firstName: "A", lastName: "A",
    });
    const id2 = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1", company: "B", firstName: "B", lastName: "B",
    });

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
  });
});

describe("contacts.mutations.update", () => {
  it("patches fields and rebuilds searchText", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Old Co",
      firstName: "Old",
      lastName: "Name",
    });

    await t.mutation(api.contacts.mutations.update, {
      id: contactId,
      company: "New Co",
      firstName: "New",
      lastName: "Name",
      email: "new@co.com",
    });

    const updated = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(updated!.company).toBe("New Co");
    expect(updated!.firstName).toBe("New");
    expect(updated!.searchText).toBe("New Co New Name new@co.com");
  });

  it("rejects an update that duplicates another contact outright", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Existing",
      firstName: "E",
      lastName: "X",
      email: "taken@test.com",
    });

    const otherId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Other",
      firstName: "O",
      lastName: "T",
      email: "other@test.com",
    });

    await expect(
      t.mutation(api.contacts.mutations.update, {
        id: otherId,
        company: "Existing",
        firstName: "O",
        lastName: "T",
        email: "taken@test.com",
      })
    ).rejects.toThrowError(/already exists with the email "taken@test.com"/);
  });

  it("allows an update onto a shared email under a different company", async () => {
    // Moving a second location onto the owner's billing email.
    const t = convexTest(schema, modules);

    await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Existing",
      firstName: "E",
      lastName: "X",
      email: "taken@test.com",
    });

    const otherId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Other",
      firstName: "O",
      lastName: "T",
      email: "other@test.com",
    });

    await t.mutation(api.contacts.mutations.update, {
      id: otherId,
      company: "Other",
      firstName: "O",
      lastName: "T",
      email: "taken@test.com",
    });

    const moved = await t.run(async (ctx) => ctx.db.get(otherId));
    expect(moved!.email).toBe("taken@test.com");
  });

  it("allows keeping the same email on the same contact", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Same",
      firstName: "S",
      lastName: "M",
      email: "keep@test.com",
    });

    await t.mutation(api.contacts.mutations.update, {
      id: contactId,
      company: "Same Updated",
      firstName: "S",
      lastName: "M",
      email: "keep@test.com",
    });

    const updated = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(updated!.company).toBe("Same Updated");
    expect(updated!.email).toBe("keep@test.com");
  });

  it("throws when contact does not exist", async () => {
    const t = convexTest(schema, modules);

    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("contacts", {
        company: "Temp", firstName: "T", lastName: "T", orgId: "org_1",
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.mutation(api.contacts.mutations.update, {
        id: fakeId,
        company: "Ghost",
        firstName: "G",
        lastName: "H",
      })
    ).rejects.toThrowError("Contact not found");
  });
});

describe("contacts.mutations.softDelete", () => {
  it("marks the contact as deleted and clears email", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Delete Me",
      firstName: "Del",
      lastName: "Eted",
      email: "del@test.com",
    });

    await t.mutation(api.contacts.mutations.softDelete, { id: contactId });

    const deleted = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(deleted!.isDeleted).toBe(true);
    expect(deleted!.email).toBeUndefined();
  });

  it("soft-deleted contact no longer appears in list queries", async () => {
    const t = convexTest(schema, modules);

    const contactId = await t.mutation(api.contacts.mutations.create, {
      orgId: "org_1",
      company: "Will Delete",
      firstName: "W",
      lastName: "D",
    });

    await t.mutation(api.contacts.mutations.softDelete, { id: contactId });

    const results = await t.query(api.contacts.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(0);
  });
});
