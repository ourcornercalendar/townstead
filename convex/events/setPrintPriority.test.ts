import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS } from "../permissions";
import { MAX_PRIORITY } from "../printPriority";

/**
 * Moving an event up or down its printed square, from the preview.
 *
 * Its own mutation rather than a call to `update`, because `update` wants
 * the whole event and the preview sends one number. The thing worth guarding
 * is that a cheap-looking mutation did not become a cheap way round the
 * permission switches.
 */

const ORG = "org_1";
const OWNER = { subject: "joyce", orgId: ORG };
const HELPER = { subject: "helper" };

const t = () => convexTest(schema, modules);
type TestInstance = ReturnType<typeof t>;

async function anEvent(
  base: TestInstance,
  extra: Record<string, unknown> = {}
) {
  return await base.run(async (ctx) =>
    ctx.db.insert("events", {
      name: "Farmers Market",
      date: 1800000000000,
      orgId: ORG,
      isDeleted: false,
      isApproved: true,
      submittedBy: "somebody_else",
      ...extra,
    })
  );
}

async function withGrant(base: TestInstance, permissions: string[]) {
  await base.run(async (ctx) => {
    await ctx.db.insert("orgPermissions", {
      userId: HELPER.subject,
      orgId: ORG,
      role: "user",
      permissions,
      isActive: true,
    });
  });
  return base.withIdentity(HELPER);
}

describe("the owner moving an event", () => {
  it("sets the position", async () => {
    const base = t();
    const id = await anEvent(base);
    await base
      .withIdentity(OWNER)
      .mutation(api.events.mutations.setPrintPriority, { id, priority: 4 });

    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.printPriority).toBe(4);
  });

  it("clears the old band as it replaces it", async () => {
    // An event carrying both a number and a band is an event with two
    // answers to the same question, and the next person reading the row has
    // to know which one wins.
    const base = t();
    const id = await anEvent(base, { printPlacement: "BOTTOM" });
    await base
      .withIdentity(OWNER)
      .mutation(api.events.mutations.setPrintPriority, { id, priority: 2 });

    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.printPriority).toBe(2);
    expect(event!.printPlacement).toBeUndefined();
  });

  it("drags a silly number into range instead of refusing it", async () => {
    // It comes from a number box someone is typing in. Refusing "0" with an
    // error is worse than quietly meaning 1.
    const base = t();
    const id = await anEvent(base);
    const owner = base.withIdentity(OWNER);

    await owner.mutation(api.events.mutations.setPrintPriority, { id, priority: 0 });
    expect((await base.run((ctx) => ctx.db.get(id)))!.printPriority).toBe(1);

    await owner.mutation(api.events.mutations.setPrintPriority, { id, priority: 9999 });
    expect((await base.run((ctx) => ctx.db.get(id)))!.printPriority).toBe(MAX_PRIORITY);

    await owner.mutation(api.events.mutations.setPrintPriority, { id, priority: 2.6 });
    expect((await base.run((ctx) => ctx.db.get(id)))!.printPriority).toBe(3);
  });

  it("changes nothing else about the event", async () => {
    const base = t();
    const id = await anEvent(base, { description: "Old Town", isScusd: true });
    const before = await base.run(async (ctx) => ctx.db.get(id));

    await base
      .withIdentity(OWNER)
      .mutation(api.events.mutations.setPrintPriority, { id, priority: 5 });

    const after = await base.run(async (ctx) => ctx.db.get(id));
    expect(after!.name).toBe(before!.name);
    expect(after!.date).toBe(before!.date);
    expect(after!.description).toBe(before!.description);
    expect(after!.isScusd).toBe(before!.isScusd);
    expect(after!.isApproved).toBe(before!.isApproved);
  });
});

describe("who else may move one", () => {
  it("is refused when not signed in", async () => {
    const base = t();
    const id = await anEvent(base);
    await expect(
      base.mutation(api.events.mutations.setPrintPriority, { id, priority: 2 })
    ).rejects.toThrow();
  });

  it("a helper with 'edit any event' may", async () => {
    const base = t();
    const id = await anEvent(base);
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_ANY,
    ]);
    await helper.mutation(api.events.mutations.setPrintPriority, { id, priority: 3 });
    expect((await base.run((ctx) => ctx.db.get(id)))!.printPriority).toBe(3);
  });

  it("a helper who may only add their own events may NOT", async () => {
    // The hole worth closing. Rearranging the printed calendar is editing
    // it, and this mutation must not be an easier door than `update`.
    const base = t();
    const id = await anEvent(base);
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_OWN,
    ]);
    await expect(
      helper.mutation(api.events.mutations.setPrintPriority, { id, priority: 3 })
    ).rejects.toThrow(/Permission denied/);
  });

  it("...but may move one they added themselves", async () => {
    const base = t();
    const id = await anEvent(base, { submittedBy: HELPER.subject });
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_OWN,
    ]);
    await helper.mutation(api.events.mutations.setPrintPriority, { id, priority: 2 });
    expect((await base.run((ctx) => ctx.db.get(id)))!.printPriority).toBe(2);
  });

  it("cannot reach an event in another organisation", async () => {
    const base = t();
    const id = await base.run(async (ctx) =>
      ctx.db.insert("events", {
        name: "Someone else's calendar",
        date: 1800000000000,
        orgId: "org_2",
        isDeleted: false,
        isApproved: true,
      })
    );
    await expect(
      base
        .withIdentity(OWNER)
        .mutation(api.events.mutations.setPrintPriority, { id, priority: 2 })
    ).rejects.toThrow();
  });
});
