import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * Giving one person one job.
 *
 * The point of these is not that the invite flow works -- it is that what the
 * invite hands out is genuinely narrow. Someone invited to add events is never
 * made an organisation member, so every admin function refuses them at the
 * server rather than at the screen, and that is what the last block checks.
 */

const ORG = "org_1";
const OTHER = "org_2";
const ADMIN = { subject: "joyce", orgId: ORG };

function asAdmin() {
  return convexTest(schema, modules).withIdentity(ADMIN);
}

describe("creating an invite", () => {
  it("is refused when not signed in", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:create"],
      })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("returns a token an admin can send", async () => {
    const t = asAdmin();
    const token = await t.mutation(api.teamInvites.mutations.create, {
      email: "Madalynn@Example.com",
      name: "Madalynn",
      permissions: ["events:create"],
    });
    expect(token).toHaveLength(32);

    const pending = await t.query(api.teamInvites.queries.listPending, {});
    expect(pending).toHaveLength(1);
    // Stored lowercased, so a differently-typed address still matches at
    // redemption time.
    expect(pending[0].email).toBe("madalynn@example.com");
  });

  it("refuses an empty permission list", async () => {
    // An empty array means "fall through to the org defaults" everywhere else
    // in this codebase, which is not what ticking no boxes should mean.
    const t = asAdmin();
    await expect(
      t.mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: [],
      })
    ).rejects.toThrow(/at least one/);
  });

  it("refuses a permission that is not assignable here", async () => {
    const t = asAdmin();
    await expect(
      t.mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:create", "portal:invoices"],
      })
    ).rejects.toThrow(/Not a permission that can be granted here/);
  });

  it("refuses approving other people's events", async () => {
    const t = asAdmin();
    await expect(
      t.mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:approve"],
      })
    ).rejects.toThrow(/Not a permission that can be granted here/);
  });

  it("refuses a second pending invite for the same address", async () => {
    const t = asAdmin();
    await t.mutation(api.teamInvites.mutations.create, {
      email: "mad@example.com",
      permissions: ["events:create"],
    });
    await expect(
      t.mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:create"],
      })
    ).rejects.toThrow(/already a pending invite/);
  });

  it("cannot be created by someone holding a limited grant", async () => {
    // The escalation path worth closing: a person given "add events" who has
    // also ended up inside the organisation must not be able to hand
    // themselves more from this screen.
    const base = convexTest(schema, modules);
    await base.run(async (ctx) => {
      await ctx.db.insert("orgPermissions", {
        userId: "madalynn",
        orgId: ORG,
        role: "user",
        permissions: ["events:create"],
        isActive: true,
      });
    });
    const asMadalynn = base.withIdentity({ subject: "madalynn", orgId: ORG });
    await expect(
      asMadalynn.mutation(api.teamInvites.mutations.create, {
        email: "friend@example.com",
        permissions: ["events:create"],
      })
    ).rejects.toThrow(/Only an administrator/);
  });
});

describe("accepting an invite", () => {
  it("creates exactly the grant that was offered", async () => {
    const base = convexTest(schema, modules);
    const token = await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        name: "Madalynn",
        permissions: ["events:create", "events:update_own"],
      });

    const asMadalynn = base.withIdentity({
      subject: "madalynn",
      email: "mad@example.com",
    });
    await asMadalynn.mutation(api.teamInvites.mutations.redeem, { token });

    const grant = await base.run(async (ctx) =>
      ctx.db
        .query("orgPermissions")
        .withIndex("by_userId_and_orgId", (q) =>
          q.eq("userId", "madalynn").eq("orgId", ORG)
        )
        .first()
    );
    expect(grant).not.toBeNull();
    expect(grant!.role).toBe("user");
    expect(grant!.isActive).toBe(true);
    expect(grant!.permissions.sort()).toEqual([
      "events:create",
      "events:update_own",
    ]);
    expect(grant!.invitedEmail).toBe("mad@example.com");
  });

  it("refuses an account signed in with a different address", async () => {
    const base = convexTest(schema, modules);
    const token = await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:create"],
      });

    const someoneElse = base.withIdentity({
      subject: "stranger",
      email: "stranger@example.com",
    });
    await expect(
      someoneElse.mutation(api.teamInvites.mutations.redeem, { token })
    ).rejects.toThrow(/was sent to mad@example.com/);
  });

  it("cannot be used twice", async () => {
    const base = convexTest(schema, modules);
    const token = await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:create"],
      });

    const asMadalynn = base.withIdentity({
      subject: "madalynn",
      email: "mad@example.com",
    });
    await asMadalynn.mutation(api.teamInvites.mutations.redeem, { token });
    await expect(
      asMadalynn.mutation(api.teamInvites.mutations.redeem, { token })
    ).rejects.toThrow(/already been used/);
  });

  it("cannot be used after it is withdrawn", async () => {
    const base = convexTest(schema, modules);
    const admin = base.withIdentity(ADMIN);
    const token = await admin.mutation(api.teamInvites.mutations.create, {
      email: "mad@example.com",
      permissions: ["events:create"],
    });
    const pending = await admin.query(api.teamInvites.queries.listPending, {});
    await admin.mutation(api.teamInvites.mutations.revoke, {
      id: pending[0]._id,
    });

    const asMadalynn = base.withIdentity({
      subject: "madalynn",
      email: "mad@example.com",
    });
    await expect(
      asMadalynn.mutation(api.teamInvites.mutations.redeem, { token })
    ).rejects.toThrow(/withdrawn/);
  });

  it("will not quietly convert an advertiser's portal account", async () => {
    const base = convexTest(schema, modules);
    const token = await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:create"],
      });

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
        userId: "madalynn",
        orgId: ORG,
        role: "contact",
        permissions: ["portal:view"],
        contactId,
        isActive: true,
      });
    });

    const asMadalynn = base.withIdentity({
      subject: "madalynn",
      email: "mad@example.com",
    });
    await expect(
      asMadalynn.mutation(api.teamInvites.mutations.redeem, { token })
    ).rejects.toThrow(/advertiser portal/);
  });
});

describe("what the accepted access actually permits", () => {
  async function inviteAndAccept(permissions: string[]) {
    const base = convexTest(schema, modules);
    await base.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: ORG,
        orgSlug: "ourcorner",
        siteName: "Our Corner",
      });
    });
    const token = await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions,
      });
    const asMadalynn = base.withIdentity({
      subject: "madalynn",
      email: "mad@example.com",
    });
    await asMadalynn.mutation(api.teamInvites.mutations.redeem, { token });
    return { base, asMadalynn };
  }

  it("publishes her events immediately with events:create", async () => {
    const { base, asMadalynn } = await inviteAndAccept(["events:create"]);
    const id = await asMadalynn.mutation(api.public.mutations.submitEvent, {
      orgSlug: "ourcorner",
      name: "Farmers Market",
      date: Date.now(),
    });
    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.isApproved).toBe(true);
  });

  it("holds her events for approval with events:submit", async () => {
    const { base, asMadalynn } = await inviteAndAccept(["events:submit"]);
    const id = await asMadalynn.mutation(api.public.mutations.submitEvent, {
      orgSlug: "ourcorner",
      name: "Farmers Market",
      date: Date.now(),
    });
    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.isApproved).toBe(false);
  });

  it("does not let her near the advertiser side", async () => {
    // She has no Clerk organisation, so requireAuth refuses before any
    // handler runs. This is the whole reason the access is honest: it is not
    // the admin screen declining to render, it is the server saying no.
    const { asMadalynn } = await inviteAndAccept(["events:create"]);
    await expect(
      asMadalynn.query(api.contacts.queries.list, { orgId: ORG })
    ).rejects.toThrow(/No organization selected/);
    await expect(
      asMadalynn.query(api.purchases.queries.list, { orgId: ORG, now: Date.now() })
    ).rejects.toThrow(/No organization selected/);
    await expect(
      asMadalynn.query(api.settings.queries.getOrgSettings, { orgId: ORG })
    ).rejects.toThrow(/No organization selected/);
  });

  it("does not let her invite anyone herself", async () => {
    const { asMadalynn } = await inviteAndAccept(["events:create"]);
    await expect(
      asMadalynn.mutation(api.teamInvites.mutations.create, {
        email: "friend@example.com",
        permissions: ["events:create"],
      })
    ).rejects.toThrow(/No organization selected/);
  });

  it("stops working the moment her access is turned off", async () => {
    const { base, asMadalynn } = await inviteAndAccept(["events:create"]);
    const members = await base
      .withIdentity(ADMIN)
      .query(api.teamInvites.queries.listMembers, {});
    expect(members).toHaveLength(1);

    await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.setMemberActive, {
        id: members[0]._id,
        isActive: false,
      });

    await expect(
      asMadalynn.mutation(api.public.mutations.submitEvent, {
        orgSlug: "ourcorner",
        name: "Nope",
        date: Date.now(),
      })
    ).rejects.toThrow(/Permission denied/);
  });
});

describe("the team list stays inside one organisation", () => {
  it("does not show another org's members or invites", async () => {
    const base = convexTest(schema, modules);
    await base.withIdentity(ADMIN).mutation(api.teamInvites.mutations.create, {
      email: "ours@example.com",
      permissions: ["events:create"],
    });

    const otherAdmin = base.withIdentity({ subject: "other", orgId: OTHER });
    expect(await otherAdmin.query(api.teamInvites.queries.listPending, {})).toEqual(
      []
    );
    expect(await otherAdmin.query(api.teamInvites.queries.listMembers, {})).toEqual(
      []
    );
  });

  it("refuses to withdraw another org's invite", async () => {
    const base = convexTest(schema, modules);
    const admin = base.withIdentity(ADMIN);
    await admin.mutation(api.teamInvites.mutations.create, {
      email: "ours@example.com",
      permissions: ["events:create"],
    });
    const pending = await admin.query(api.teamInvites.queries.listPending, {});

    const otherAdmin = base.withIdentity({ subject: "other", orgId: OTHER });
    await expect(
      otherAdmin.mutation(api.teamInvites.mutations.revoke, {
        id: pending[0]._id,
      })
    ).rejects.toThrow(/Invite not found/);
  });
});

describe("approving what she submits", () => {
  async function submittedEvent() {
    const base = convexTest(schema, modules);
    await base.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: ORG,
        orgSlug: "ourcorner",
        siteName: "Our Corner",
      });
    });
    const token = await base
      .withIdentity(ADMIN)
      .mutation(api.teamInvites.mutations.create, {
        email: "mad@example.com",
        permissions: ["events:submit"],
      });
    const asMadalynn = base.withIdentity({
      subject: "madalynn",
      email: "mad@example.com",
    });
    await asMadalynn.mutation(api.teamInvites.mutations.redeem, { token });
    const id = await asMadalynn.mutation(api.public.mutations.submitEvent, {
      orgSlug: "ourcorner",
      name: "Farmers Market",
      date: Date.now(),
    });
    return { base, asMadalynn, id };
  }

  it("the event waits, and the admin can see it", async () => {
    const { base, id } = await submittedEvent();
    const all = await base
      .withIdentity(ADMIN)
      .query(api.events.queries.list, { orgId: ORG });
    const found = all.find((e) => e._id === id);
    expect(found).toBeDefined();
    expect(found!.isApproved).toBe(false);
    expect(found!.submittedBy).toBe("madalynn");
  });

  it("shows up in the approvals queue, and on the sidebar count", async () => {
    const { base, id } = await submittedEvent();
    const admin = base.withIdentity(ADMIN);
    const pending = await admin.query(api.approvals.queries.listPending, {});
    expect(pending.events.map((e) => e._id)).toContain(id);
    const counts = await admin.query(api.approvals.queries.countPending, {});
    expect(counts.total).toBe(1);
  });

  it("the admin can approve it", async () => {
    // This failed before `requireOrgMemberPermission` existed: nothing writes
    // an orgPermissions row for the person who owns the organisation, so the
    // check fell through to the public defaults, which do not include
    // approving. The Approve button errored for the one person it was for.
    const { base, id } = await submittedEvent();
    await base
      .withIdentity(ADMIN)
      .mutation(api.events.mutations.approve, { id });
    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.isApproved).toBe(true);
  });

  it("the admin can edit it", async () => {
    const { base, id } = await submittedEvent();
    await base.withIdentity(ADMIN).mutation(api.events.mutations.update, {
      id,
      name: "Farmers Market (corrected)",
      date: Date.now(),
    });
    const event = await base.run(async (ctx) => ctx.db.get(id));
    expect(event!.name).toBe("Farmers Market (corrected)");
  });

  it("the admin can reject it, and it leaves the list", async () => {
    const { base, id } = await submittedEvent();
    await base.withIdentity(ADMIN).mutation(api.events.mutations.reject, { id });
    const all = await base
      .withIdentity(ADMIN)
      .query(api.events.queries.list, { orgId: ORG });
    expect(all.find((e) => e._id === id)).toBeUndefined();
  });

  it("she cannot approve her own submission", async () => {
    // The other half of the fix: a member holding a limited grant is still
    // held to it. She has events:submit and nothing else.
    const { asMadalynn, id } = await submittedEvent();
    await expect(
      asMadalynn.mutation(api.events.mutations.approve, { id })
    ).rejects.toThrow(/No organization selected/);
  });

  it("a restricted member of the org cannot approve either", async () => {
    // Belt and braces: even if someone with a limited grant were also added
    // to the Clerk organisation, the grant still governs.
    const { base, id } = await submittedEvent();
    const insider = base.withIdentity({ subject: "madalynn", orgId: ORG });
    await expect(
      insider.mutation(api.events.mutations.approve, { id })
    ).rejects.toThrow(/Permission denied: events:approve/);
  });
});
