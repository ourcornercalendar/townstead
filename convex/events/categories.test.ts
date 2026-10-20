import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Filing an event under one of the owner's own categories ("CSD", "School
// District", and so on).
//
// `categoryId` was in the events schema from the start, but neither create
// nor update accepted it, so nothing could ever set one — which is also why
// the category buttons on the public events page matched nothing. These tests
// pin the whole path: the mutation takes it, the public query filters on it,
// and clearing it actually clears it.

const asOwner = () =>
  convexTest(schema, modules).withIdentity({
    subject: "test_user",
    orgId: "org_1",
  });

async function makeCategory(
  t: ReturnType<typeof asOwner>,
  name: string
): Promise<Id<"categories">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("categories", { name, type: "event", orgId: "org_1" })
  );
}

describe("events + categories", () => {
  it("creates an event filed under a category", async () => {
    const t = asOwner();
    const csd = await makeCategory(t, "CSD");

    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Board Meeting",
      date: 1720000000000,
      categoryId: csd,
    });

    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.categoryId).toBe(csd);
  });

  it("still creates an event with no category", async () => {
    // Joyce is adding categories to a calendar that already has years of
    // events in it. An event without one has to stay saveable.
    const t = asOwner();
    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Uncategorised",
      date: 1720000000000,
    });
    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.categoryId).toBeUndefined();
  });

  it("files an existing event under a category", async () => {
    const t = asOwner();
    const schools = await makeCategory(t, "School District");
    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "First Day of School",
      date: 1720000000000,
    });

    await t.mutation(api.events.mutations.update, {
      id,
      name: "First Day of School",
      date: 1720000000000,
      categoryId: schools,
    });

    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.categoryId).toBe(schools);
  });

  it("moves an event from one category to another", async () => {
    const t = asOwner();
    const csd = await makeCategory(t, "CSD");
    const schools = await makeCategory(t, "School District");
    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Movable",
      date: 1720000000000,
      categoryId: csd,
    });

    await t.mutation(api.events.mutations.update, {
      id,
      name: "Movable",
      date: 1720000000000,
      categoryId: schools,
    });

    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.categoryId).toBe(schools);
  });

  it("clears a category when the form sends none", async () => {
    // The form's "No category" option sends categoryId: undefined, and Convex
    // treats an undefined field in a patch as "remove it". If that ever
    // changes, a category could not be taken off an event.
    const t = asOwner();
    const csd = await makeCategory(t, "CSD");
    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Was Filed",
      date: 1720000000000,
      categoryId: csd,
    });

    await t.mutation(api.events.mutations.update, {
      id,
      name: "Was Filed",
      date: 1720000000000,
      categoryId: null,
    });

    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.categoryId).toBeUndefined();
  });

  it("leaves the category alone when the field is not sent at all", async () => {
    // The other half of the null/absent distinction. An edit from a form that
    // does not deal in categories must not wipe one.
    const t = asOwner();
    const csd = await makeCategory(t, "CSD");
    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Keep My Category",
      date: 1720000000000,
      categoryId: csd,
    });

    await t.mutation(api.events.mutations.update, {
      id,
      name: "Renamed, nothing else touched",
      date: 1720000000000,
    });

    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.name).toBe("Renamed, nothing else touched");
    expect(event!.categoryId).toBe(csd);
  });

  it("accepts null on create as 'no category'", async () => {
    const t = asOwner();
    const id = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Explicitly none",
      date: 1720000000000,
      categoryId: null,
    });
    const event = await t.run(async (ctx) => ctx.db.get(id));
    expect(event!.categoryId).toBeUndefined();
  });
});

describe("the public events page can filter by category", () => {
  // The bug this whole change exists to fix: the buttons were real, the query
  // was real, and they matched nothing because the field was always empty.
  it("returns only the events in the chosen category", async () => {
    const t = asOwner();
    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "townstead",
      });
    });
    const csd = await makeCategory(t, "CSD");
    const schools = await makeCategory(t, "School District");

    await t.mutation(api.events.mutations.create, {
      orgId: "org_1", name: "CSD Board Meeting", date: 1720000000000, categoryId: csd,
    });
    await t.mutation(api.events.mutations.create, {
      orgId: "org_1", name: "Parent Evening", date: 1720000000000, categoryId: schools,
    });
    await t.mutation(api.events.mutations.create, {
      orgId: "org_1", name: "Nothing In Particular", date: 1720000000000,
    });

    const all = await t.query(api.public.queries.listEvents, {
      orgSlug: "townstead",
      startDate: 1719000000000,
      endDate: 1721000000000,
    });
    expect(all.map((e) => e.name).sort()).toEqual([
      "CSD Board Meeting",
      "Nothing In Particular",
      "Parent Evening",
    ]);

    const onlyCsd = await t.query(api.public.queries.listEvents, {
      orgSlug: "townstead",
      startDate: 1719000000000,
      endDate: 1721000000000,
      categoryId: csd,
    });
    expect(onlyCsd.map((e) => e.name)).toEqual(["CSD Board Meeting"]);

    const onlySchools = await t.query(api.public.queries.listEvents, {
      orgSlug: "townstead",
      startDate: 1719000000000,
      endDate: 1721000000000,
      categoryId: schools,
    });
    expect(onlySchools.map((e) => e.name)).toEqual(["Parent Evening"]);
  });
});
