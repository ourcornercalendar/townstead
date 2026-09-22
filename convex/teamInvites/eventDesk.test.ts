import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * The events desk.
 *
 * A helper invited to keep the print calendar is not a member of the Clerk
 * organisation. That non-membership is what keeps contacts, purchases and
 * billing shut at the server, so opening the events tables to her had to be
 * done as one specific door rather than by letting her in generally. These
 * check that the door opens, and that it is the only one.
 */

const ORG = "org_1";
const OTHER = "org_2";
const ADMIN = { subject: "joyce", orgId: ORG };

async function withHelper(permissions: string[]) {
  const base = convexTest(schema, modules);
  const token = await base
    .withIdentity(ADMIN)
    .mutation(api.teamInvites.mutations.create, {
      email: "mad@example.com",
      name: "Madalynn",
      permissions,
    });
  const helper = base.withIdentity({
    subject: "madalynn",
    email: "mad@example.com",
  });
  await helper.mutation(api.teamInvites.mutations.redeem, { token });
  return { base, helper };
}

describe("a helper can do the print-calendar job", () => {
  it("creates an event with its edition, placement and red-ink flag", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:manage_all",
    ]);
    const editionId = await base.run(async (ctx) =>
      ctx.db.insert("calendarEditions", {
        orgId: ORG,
        name: "Elk Grove 2027",
        code: "EG27",
        isDeleted: false,
      })
    );

    const id = await helper.mutation(api.events.mutations.create, {
      orgId: ORG,
      name: "Farmers Market",
      date: Date.now(),
      calendarEditionIds: [editionId],
      printPlacement: "MIDDLE",
      isScusd: true,
    });

    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.printPlacement).toBe("MIDDLE");
    expect(event!.isScusd).toBe(true);
    expect(event!.calendarEditionIds).toEqual([editionId]);
    // Recorded as hers, which is what "only her own" later rests on.
    expect(event!.submittedBy).toBe("madalynn");
    expect(event!.isApproved).toBe(true);
  });

  it("holds it for approval on the submit tier", async () => {
    const { base, helper } = await withHelper(["events:submit"]);
    const id = await helper.mutation(api.events.mutations.create, {
      orgId: ORG,
      name: "Waiting",
      date: Date.now(),
    });
    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.isApproved).toBe(false);
  });

  it("reads the editions and categories the form offers", async () => {
    const { base, helper } = await withHelper(["events:create"]);
    await base.run(async (ctx) => {
      await ctx.db.insert("calendarEditions", {
        orgId: ORG,
        name: "Elk Grove 2027",
        code: "EG27",
        isDeleted: false,
      });
    });
    const editions = await helper.query(api.calendarEditions.queries.list, {
      orgId: ORG,
    });
    expect(editions).toHaveLength(1);
    await expect(
      helper.query(api.categories.queries.list, { orgId: ORG })
    ).resolves.toBeDefined();
  });

  it("sees the whole calendar with events:manage_all", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:manage_all",
    ]);
    await base.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Joyce's own",
        date: Date.now(),
        orgId: ORG,
        isApproved: true,
        isDeleted: false,
      });
    });
    const events = await helper.query(api.events.queries.list, { orgId: ORG });
    expect(events.map((e) => e.name)).toContain("Joyce's own");
  });

  it("edits and deletes anyone's event with events:manage_all", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:manage_all",
    ]);
    const id = await base.run(async (ctx) =>
      ctx.db.insert("events", {
        name: "Joyce's own",
        date: Date.now(),
        orgId: ORG,
        isApproved: true,
        isDeleted: false,
      })
    );
    await helper.mutation(api.events.mutations.update, {
      id,
      name: "Corrected",
      date: Date.now(),
    });
    expect((await base.run(async (ctx) => ctx.db.get(id)))!.name).toBe(
      "Corrected"
    );
    await helper.mutation(api.events.mutations.softDelete, { id });
    expect((await base.run(async (ctx) => ctx.db.get(id)))!.isDeleted).toBe(
      true
    );
  });
});

describe("without events:manage_all it really is only her own", () => {
  it("sees only what she added", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:update_own",
    ]);
    await base.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Joyce's own",
        date: Date.now(),
        orgId: ORG,
        isApproved: true,
        isDeleted: false,
      });
    });
    await helper.mutation(api.events.mutations.create, {
      orgId: ORG,
      name: "Hers",
      date: Date.now(),
    });

    const events = await helper.query(api.events.queries.list, { orgId: ORG });
    expect(events.map((e) => e.name)).toEqual(["Hers"]);
  });

  it("is refused when editing someone else's", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:update_own",
    ]);
    const id = await base.run(async (ctx) =>
      ctx.db.insert("events", {
        name: "Joyce's own",
        date: Date.now(),
        orgId: ORG,
        isApproved: true,
        isDeleted: false,
      })
    );
    await expect(
      helper.mutation(api.events.mutations.update, {
        id,
        name: "Meddling",
        date: Date.now(),
      })
    ).rejects.toThrow(/Permission denied/);
  });
});

describe("the door opens onto events and nothing else", () => {
  it("still refuses contacts, purchases and settings", async () => {
    const { helper } = await withHelper(["events:create", "events:manage_all"]);
    await expect(
      helper.query(api.contacts.queries.list, { orgId: ORG })
    ).rejects.toThrow(/No organization selected/);
    await expect(
      helper.query(api.purchases.queries.list, { orgId: ORG, now: Date.now() })
    ).rejects.toThrow(/No organization selected/);
    await expect(
      helper.query(api.settings.queries.getOrgSettings, { orgId: ORG })
    ).rejects.toThrow(/No organization selected/);
  });

  it("still refuses approving other people's submissions", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:manage_all",
    ]);
    const id = await base.run(async (ctx) =>
      ctx.db.insert("events", {
        name: "Someone else's",
        date: Date.now(),
        orgId: ORG,
        isApproved: false,
        isDeleted: false,
      })
    );
    await expect(
      helper.mutation(api.events.mutations.approve, { id })
    ).rejects.toThrow(/No organization selected/);
  });

  it("cannot reach another organisation's events", async () => {
    const { helper } = await withHelper(["events:create", "events:manage_all"]);
    await expect(
      helper.query(api.events.queries.list, { orgId: OTHER })
    ).rejects.toThrow(/Not authorized for this organization/);
    await expect(
      helper.mutation(api.events.mutations.create, {
        orgId: OTHER,
        name: "Wrong org",
        date: Date.now(),
      })
    ).rejects.toThrow(/Not authorized for this organization/);
  });

  it("stops the moment her access is turned off", async () => {
    const { base, helper } = await withHelper([
      "events:create",
      "events:manage_all",
    ]);
    const members = await base
      .withIdentity(ADMIN)
      .query(api.teamInvites.queries.listMembers, {});
    await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.setMemberActive, {
        id: members[0]._id,
        isActive: false,
      });

    await expect(
      helper.query(api.events.queries.list, { orgId: ORG })
    ).rejects.toThrow(/Not authorized for this organization/);
    await expect(
      helper.mutation(api.events.mutations.create, {
        orgId: ORG,
        name: "Nope",
        date: Date.now(),
      })
    ).rejects.toThrow(/Not authorized for this organization/);
  });

  it("refuses a signed-in stranger with no grant at all", async () => {
    const base = convexTest(schema, modules);
    const stranger = base.withIdentity({ subject: "nobody" });
    await expect(
      base.withIdentity({ subject: "nobody" }).query(api.events.queries.list, {
        orgId: ORG,
      })
    ).rejects.toThrow(/Not authorized for this organization/);
    await expect(
      stranger.mutation(api.events.mutations.create, {
        orgId: ORG,
        name: "Intruder",
        date: Date.now(),
      })
    ).rejects.toThrow(/Not authorized for this organization/);
  });

  it("refuses an advertiser's portal account", async () => {
    // A contact grant opens the billing portal, not the calendar.
    const base = convexTest(schema, modules);
    const contactId = await base.run(async (ctx) =>
      ctx.db.insert("contacts", {
        orgId: ORG,
        company: "Advertiser Co",
        firstName: "A",
        lastName: "B",
        isDeleted: false,
      })
    );
    await base.run(async (ctx) => {
      await ctx.db.insert("orgPermissions", {
        userId: "advertiser",
        orgId: ORG,
        role: "contact",
        permissions: ["events:submit", "portal:view"],
        contactId,
        isActive: true,
      });
    });
    await expect(
      base
        .withIdentity({ subject: "advertiser" })
        .query(api.events.queries.list, { orgId: ORG })
    ).rejects.toThrow(/Not authorized for this organization/);
  });
});

describe("what the desk shows the person standing at it", () => {
  it("reports the tier and what they may change", async () => {
    const { helper } = await withHelper([
      "events:create",
      "events:manage_all",
    ]);
    const ws = await helper.query(api.teamInvites.queries.myWorkspace, {});
    expect(ws).not.toBeNull();
    expect(ws!.orgId).toBe(ORG);
    expect(ws!.publishesImmediately).toBe(true);
    expect(ws!.canManageAll).toBe(true);
    expect(ws!.name).toBe("Madalynn");
  });

  it("is null for an administrator, who belongs in /admin", async () => {
    const t = convexTest(schema, modules).withIdentity(ADMIN);
    expect(await t.query(api.teamInvites.queries.myWorkspace, {})).toBeNull();
  });

  it("is null for someone signed out", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.teamInvites.queries.myWorkspace, {})).toBeNull();
  });
});
