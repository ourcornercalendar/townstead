import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS, TEAM_ASSIGNABLE_PERMISSIONS } from "../permissions";
import type { Id } from "../_generated/dataModel";

// The switches the owner asked for: add / edit / delete events, add / edit /
// delete categories, and approve.
//
// Every one of these is tested from BOTH sides — granted and not granted —
// because a permission check that never refuses anything passes a test suite
// just as happily as one that works.

const ORG = "org_1";
const OWNER = { subject: "owner_user", orgId: ORG };      // Clerk org member
const HELPER = { subject: "helper_user" };                 // no org claim at all

const t = () => convexTest(schema, modules);
// Bare `ReturnType<typeof convexTest>` drops the schema, so the handle it
// produces is not the one `t()` returns. Name it off `t` instead.
type TestInstance = ReturnType<typeof t>;

/** A helper with exactly these permissions and nothing else. */
async function withGrant(
  base: TestInstance,
  permissions: string[]
) {
  await base.run(async (ctx) => {
    ctx.db.insert("orgPermissions", {
      userId: HELPER.subject,
      orgId: ORG,
      role: "user",
      permissions,
      isActive: true,
      invitedEmail: "helper@example.com",
    });
  });
  return base.withIdentity(HELPER);
}

async function makeCategory(base: TestInstance, name = "CSD") {
  return await base.run(async (ctx) =>
    ctx.db.insert("categories", { name, type: "event", orgId: ORG })
  );
}

async function makeEvent(
  base: TestInstance,
  submittedBy: string,
  name = "Someone else's event"
) {
  return await base.run(async (ctx) =>
    ctx.db.insert("events", {
      name,
      date: 1720000000000,
      orgId: ORG,
      isDeleted: false,
      isApproved: true,
      submittedBy,
    })
  );
}

describe("the switches are offered to the owner at all", () => {
  it("every new allowance can actually be handed out", () => {
    for (const p of [
      PERMISSIONS.EVENTS_UPDATE_ANY,
      PERMISSIONS.EVENTS_DELETE_ANY,
      PERMISSIONS.EVENTS_APPROVE,
      PERMISSIONS.CATEGORIES_CREATE,
      PERMISSIONS.CATEGORIES_UPDATE,
      PERMISSIONS.CATEGORIES_DELETE,
    ]) {
      expect(TEAM_ASSIGNABLE_PERMISSIONS, p).toContain(p);
    }
  });

  it("still refuses to hand out the advertiser billing portal", () => {
    for (const p of TEAM_ASSIGNABLE_PERMISSIONS) {
      expect(p.startsWith("portal:")).toBe(false);
    }
  });
});

describe("editing anyone's event", () => {
  it("is refused without the permission", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_OWN,
    ]);
    await expect(
      helper.mutation(api.events.mutations.update, {
        id, name: "Renamed by a helper", date: 1720000000000,
      })
    ).rejects.toThrow(/Permission denied/);
  });

  it("is allowed with it", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_ANY,
    ]);
    await helper.mutation(api.events.mutations.update, {
      id, name: "Renamed by a helper", date: 1720000000000,
    });
    const row = await base.run(async (ctx) => ctx.db.get(id));
    expect(row!.name).toBe("Renamed by a helper");
  });

  it("does not also let them delete", async () => {
    // The whole point of splitting the switches: edit must not imply delete.
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_ANY,
    ]);
    await expect(
      helper.mutation(api.events.mutations.softDelete, { id })
    ).rejects.toThrow(/Permission denied/);
  });

  it("still lets them fix their own either way", async () => {
    const base = t();
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_OWN,
    ]);
    const id = await helper.mutation(api.events.mutations.create, {
      orgId: ORG, name: "Mine", date: 1720000000000,
    });
    await helper.mutation(api.events.mutations.update, {
      id, name: "Mine, corrected", date: 1720000000000,
    });
    const row = await base.run(async (ctx) => ctx.db.get(id));
    expect(row!.name).toBe("Mine, corrected");
  });
});

describe("deleting anyone's event", () => {
  it("is refused without the permission", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_DELETE_OWN,
    ]);
    await expect(
      helper.mutation(api.events.mutations.softDelete, { id })
    ).rejects.toThrow(/Permission denied/);
  });

  it("is allowed with it, and does not also let them edit", async () => {
    const base = t();
    const theirs = await makeEvent(base, "somebody_else", "A");
    const other = await makeEvent(base, "somebody_else", "B");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_DELETE_ANY,
    ]);
    await helper.mutation(api.events.mutations.softDelete, { id: theirs });
    expect((await base.run(async (ctx) => ctx.db.get(theirs)))!.isDeleted).toBe(true);

    await expect(
      helper.mutation(api.events.mutations.update, {
        id: other, name: "nope", date: 1720000000000,
      })
    ).rejects.toThrow(/Permission denied/);
  });
});

describe("the older combined permission keeps working", () => {
  // Anyone granted events:manage_all before the switches were split must not
  // quietly lose access the day this deploys.
  it("still means both edit and delete", async () => {
    const base = t();
    const a = await makeEvent(base, "somebody_else", "A");
    const b = await makeEvent(base, "somebody_else", "B");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_MANAGE_ALL,
    ]);
    await helper.mutation(api.events.mutations.update, {
      id: a, name: "edited", date: 1720000000000,
    });
    await helper.mutation(api.events.mutations.softDelete, { id: b });
    expect((await base.run(async (ctx) => ctx.db.get(a)))!.name).toBe("edited");
    expect((await base.run(async (ctx) => ctx.db.get(b)))!.isDeleted).toBe(true);
  });
});

describe("seeing the calendar you are allowed to change", () => {
  it("without any 'any' permission, a helper sees only their own", async () => {
    const base = t();
    await makeEvent(base, "somebody_else", "Not mine");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_OWN,
    ]);
    await helper.mutation(api.events.mutations.create, {
      orgId: ORG, name: "Mine", date: 1720000000000,
    });
    const list = await helper.query(api.events.queries.list, { orgId: ORG });
    expect(list.map((e) => e.name)).toEqual(["Mine"]);
  });

  it("a helper who can edit anything can see everything", async () => {
    // Otherwise the permission is to change something they cannot find.
    const base = t();
    await makeEvent(base, "somebody_else", "Not mine");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_ANY,
    ]);
    const list = await helper.query(api.events.queries.list, { orgId: ORG });
    expect(list.map((e) => e.name)).toContain("Not mine");
  });

  it("so can one who can only approve", async () => {
    const base = t();
    await makeEvent(base, "somebody_else", "Not mine");
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_SUBMIT,
      PERMISSIONS.EVENTS_APPROVE,
    ]);
    const list = await helper.query(api.events.queries.list, { orgId: ORG });
    expect(list.map((e) => e.name)).toContain("Not mine");
  });
});

describe("approving", () => {
  it("is refused without the permission", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    await base.run(async (ctx) => ctx.db.patch(id, { isApproved: false }));
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_ANY,
    ]);
    await expect(
      helper.mutation(api.events.mutations.approve, { id })
    ).rejects.toThrow();
    expect((await base.run(async (ctx) => ctx.db.get(id)))!.isApproved).toBe(false);
  });

  it("is allowed with it", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    await base.run(async (ctx) => ctx.db.patch(id, { isApproved: false }));
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_SUBMIT,
      PERMISSIONS.EVENTS_APPROVE,
    ]);
    await helper.mutation(api.events.mutations.approve, { id });
    expect((await base.run(async (ctx) => ctx.db.get(id)))!.isApproved).toBe(true);
  });

  it("rejecting needs the same permission", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    const noApprove = await withGrant(base, [PERMISSIONS.EVENTS_CREATE]);
    await expect(
      noApprove.mutation(api.events.mutations.reject, { id })
    ).rejects.toThrow();
  });

  it("the owner can still approve, as she always could", async () => {
    const base = t();
    const id = await makeEvent(base, "somebody_else");
    await base.run(async (ctx) => ctx.db.patch(id, { isApproved: false }));
    await base.withIdentity(OWNER).mutation(api.events.mutations.approve, { id });
    expect((await base.run(async (ctx) => ctx.db.get(id)))!.isApproved).toBe(true);
  });
});

describe("categories", () => {
  it("adding is refused without the permission", async () => {
    const base = t();
    const helper = await withGrant(base, [PERMISSIONS.EVENTS_CREATE]);
    await expect(
      helper.mutation(api.categories.mutations.create, {
        orgId: ORG, name: "CSD", type: "event",
      })
    ).rejects.toThrow();
  });

  it("adding is allowed with it", async () => {
    const base = t();
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_CREATE,
    ]);
    const id = await helper.mutation(api.categories.mutations.create, {
      orgId: ORG, name: "CSD", type: "event",
    });
    expect((await base.run(async (ctx) => ctx.db.get(id)))!.name).toBe("CSD");
  });

  it("adding does not also allow renaming or deleting", async () => {
    const base = t();
    const cat = await makeCategory(base);
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_CREATE,
    ]);
    await expect(
      helper.mutation(api.categories.mutations.update, { id: cat, name: "Nope" })
    ).rejects.toThrow();
    await expect(
      helper.mutation(api.categories.mutations.softDelete, { id: cat })
    ).rejects.toThrow();
  });

  it("renaming is refused without the permission and allowed with it", async () => {
    const base = t();
    const cat = await makeCategory(base);
    const without = await withGrant(base, [PERMISSIONS.EVENTS_CREATE]);
    await expect(
      without.mutation(api.categories.mutations.update, { id: cat, name: "X" })
    ).rejects.toThrow();

    const base2 = t();
    const cat2 = await makeCategory(base2);
    const withPerm = await withGrant(base2, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_UPDATE,
    ]);
    await withPerm.mutation(api.categories.mutations.update, {
      id: cat2, name: "School District",
    });
    expect((await base2.run(async (ctx) => ctx.db.get(cat2)))!.name).toBe(
      "School District"
    );
  });

  it("deleting is refused without the permission and allowed with it", async () => {
    const base = t();
    const cat = await makeCategory(base);
    const without = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_UPDATE,
    ]);
    await expect(
      without.mutation(api.categories.mutations.softDelete, { id: cat })
    ).rejects.toThrow();

    const base2 = t();
    const cat2 = await makeCategory(base2);
    const withPerm = await withGrant(base2, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_DELETE,
    ]);
    await withPerm.mutation(api.categories.mutations.softDelete, { id: cat2 });
    expect((await base2.run(async (ctx) => ctx.db.get(cat2)))!.isDeleted).toBe(true);
  });

  it("the owner can still manage categories with no grant at all", async () => {
    // She has no orgPermissions row — ownership lives in Clerk. This is the
    // trap that once stopped her approving anything.
    const base = t();
    const owner = base.withIdentity(OWNER);
    const id = await owner.mutation(api.categories.mutations.create, {
      orgId: ORG, name: "Owner's category", type: "event",
    });
    await owner.mutation(api.categories.mutations.update, { id, name: "Renamed" });
    await owner.mutation(api.categories.mutations.softDelete, { id });
    const row = await base.run(async (ctx) => ctx.db.get(id));
    expect(row!.name).toBe("Renamed");
    expect(row!.isDeleted).toBe(true);
  });

  it("a signed-in stranger with no grant cannot touch them", async () => {
    const base = t();
    const cat = await makeCategory(base);
    const stranger = base.withIdentity({ subject: "nobody" });
    await expect(
      stranger.mutation(api.categories.mutations.create, {
        orgId: ORG, name: "Hello", type: "event",
      })
    ).rejects.toThrow();
    await expect(
      stranger.mutation(api.categories.mutations.update, { id: cat, name: "Hello" })
    ).rejects.toThrow();
  });

  it("an inactive helper cannot use a permission they still hold", async () => {
    const base = t();
    const helper = await withGrant(base, [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_CREATE,
    ]);
    await base.run(async (ctx) => {
      const grant = await ctx.db
        .query("orgPermissions")
        .filter((q) => q.eq(q.field("userId"), HELPER.subject))
        .first();
      await ctx.db.patch(grant!._id as Id<"orgPermissions">, { isActive: false });
    });
    await expect(
      helper.mutation(api.categories.mutations.create, {
        orgId: ORG, name: "Sneaky", type: "event",
      })
    ).rejects.toThrow();
  });
});

describe("what the event desk is told", () => {
  const workspaceFor = async (permissions: string[]) => {
    const base = t();
    await base.run(async (ctx) => {
      ctx.db.insert("tenantBranding", { orgId: ORG, orgSlug: "townstead" });
    });
    const helper = await withGrant(base, permissions);
    return await helper.query(api.teamInvites.queries.myWorkspace, {});
  };

  it("reports the category permissions so the panel can appear", async () => {
    const ws = await workspaceFor([
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.CATEGORIES_CREATE,
    ]);
    expect(ws!.canAddCategories).toBe(true);
    expect(ws!.canEditCategories).toBe(false);
    expect(ws!.canDeleteCategories).toBe(false);
  });

  it("reports edit and delete separately", async () => {
    const ws = await workspaceFor([
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_ANY,
    ]);
    expect(ws!.canEditAny).toBe(true);
    expect(ws!.canDeleteAny).toBe(false);
  });

  it("still reports both for the older combined permission", async () => {
    const ws = await workspaceFor([
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_MANAGE_ALL,
    ]);
    expect(ws!.canEditAny).toBe(true);
    expect(ws!.canDeleteAny).toBe(true);
  });

  it("reports approve", async () => {
    const ws = await workspaceFor([
      PERMISSIONS.EVENTS_SUBMIT,
      PERMISSIONS.EVENTS_APPROVE,
    ]);
    expect(ws!.canApprove).toBe(true);
  });
});
