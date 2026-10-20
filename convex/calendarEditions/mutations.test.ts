import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("calendarEditions.mutations.create", () => {
  it("creates a calendar edition with the given fields", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Spring 2026", code: "SP26",
    });

    const edition = await t.run(async (ctx) => ctx.db.get(editionId));
    expect(edition).not.toBeNull();
    expect(edition!.name).toBe("Spring 2026");
    expect(edition!.code).toBe("SP26");
    expect(edition!.orgId).toBe("org_1");
    expect(edition!.isDeleted).toBe(false);
  });

  it("rejects duplicate code within the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "First", code: "DUP",
    });

    await expect(
      t.mutation(api.calendarEditions.mutations.create, {
        orgId: "org_1", name: "Second", code: "DUP",
      })
    ).rejects.toThrowError('A calendar edition with code "DUP" already exists');
  });

  it("allows the same code in different orgs", async () => {
    const base = convexTest(schema, modules);
    const asA = base.withIdentity({ subject: "user_a", orgId: "org_a" });
    const asB = base.withIdentity({ subject: "user_b", orgId: "org_b" });

    await asA.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_a", name: "Org A Edition", code: "SHARED",
    });

    const id = await asB.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_b", name: "Org B Edition", code: "SHARED",
    });

    expect(id).toBeTruthy();
  });

  it("allows reusing code of a soft-deleted edition in the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const firstId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Old Edition", code: "REUSE",
    });

    await t.mutation(api.calendarEditions.mutations.softDelete, { id: firstId });

    const secondId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "New Edition", code: "REUSE",
    });

    expect(secondId).toBeTruthy();
  });
});

describe("calendarEditions.mutations.update", () => {
  it("patches name and code on an existing edition", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Old Name", code: "OLD",
    });

    await t.mutation(api.calendarEditions.mutations.update, {
      id: editionId, name: "New Name", code: "NEW",
    });

    const updated = await t.run(async (ctx) => ctx.db.get(editionId));
    expect(updated!.name).toBe("New Name");
    expect(updated!.code).toBe("NEW");
  });

  it("rejects duplicate code on update within the same org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Existing", code: "TAKEN",
    });

    const otherId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Other", code: "OTHER",
    });

    await expect(
      t.mutation(api.calendarEditions.mutations.update, {
        id: otherId, name: "Other", code: "TAKEN",
      })
    ).rejects.toThrowError('A calendar edition with code "TAKEN" already exists');
  });

  it("allows keeping the same code on the same edition", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Same Code", code: "KEEP",
    });

    await t.mutation(api.calendarEditions.mutations.update, {
      id: editionId, name: "Updated Name", code: "KEEP",
    });

    const updated = await t.run(async (ctx) => ctx.db.get(editionId));
    expect(updated!.name).toBe("Updated Name");
    expect(updated!.code).toBe("KEEP");
  });

  it("throws when edition does not exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("calendarEditions", {
        name: "Temp", code: "TMP", orgId: "org_1",
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.mutation(api.calendarEditions.mutations.update, {
        id: fakeId, name: "Ghost", code: "GHO",
      })
    ).rejects.toThrowError("Calendar edition not found");
  });
});

describe("calendarEditions.mutations.create — community linking", () => {
  it("adds the edition to the community's calendarEditionIds when communityId is provided", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Downtown", slug: "downtown", orgId: "org_1",
        calendarEditionIds: [], isDeleted: false,
      })
    );

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Spring 2026", code: "SP26", communityId,
    });

    const community = await t.run(async (ctx) => ctx.db.get(communityId));
    expect(community!.calendarEditionIds).toContain(editionId);
  });

  it("does not modify any community when communityId is omitted", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Downtown", slug: "downtown", orgId: "org_1",
        calendarEditionIds: [], isDeleted: false,
      })
    );

    await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Spring 2026", code: "SP26",
    });

    const community = await t.run(async (ctx) => ctx.db.get(communityId));
    expect(community!.calendarEditionIds).toHaveLength(0);
  });

  it("throws when communityId belongs to a different org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Other Org Community", slug: "other", orgId: "org_b",
        calendarEditionIds: [], isDeleted: false,
      })
    );

    await expect(
      t.mutation(api.calendarEditions.mutations.create, {
        orgId: "org_a", name: "Edition", code: "ED", communityId,
      })
    ).rejects.toThrowError("Community not found");
  });

  it("throws when communityId does not exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const fakeCommunityId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("communities", {
        name: "Temp", slug: "tmp", orgId: "org_1",
        calendarEditionIds: [], isDeleted: false,
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.mutation(api.calendarEditions.mutations.create, {
        orgId: "org_1", name: "Edition", code: "ED", communityId: fakeCommunityId,
      })
    ).rejects.toThrowError("Community not found");
  });

  it("preserves existing calendarEditionIds on the community", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const existingEditionId = await t.run(async (ctx) =>
      ctx.db.insert("calendarEditions", {
        name: "Existing", code: "EX", orgId: "org_1", isDeleted: false,
      })
    );

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Downtown", slug: "downtown", orgId: "org_1",
        calendarEditionIds: [existingEditionId], isDeleted: false,
      })
    );

    const newEditionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "New", code: "NEW", communityId,
    });

    const community = await t.run(async (ctx) => ctx.db.get(communityId));
    expect(community!.calendarEditionIds).toHaveLength(2);
    expect(community!.calendarEditionIds).toContain(existingEditionId);
    expect(community!.calendarEditionIds).toContain(newEditionId);
  });
});

describe("calendarEditions.mutations.update — community linking", () => {
  it("assigns edition to a community when communityId is provided", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Edition", code: "ED",
    });

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Downtown", slug: "downtown", orgId: "org_1",
        calendarEditionIds: [], isDeleted: false,
      })
    );

    await t.mutation(api.calendarEditions.mutations.update, {
      id: editionId, name: "Edition", code: "ED", communityId,
    });

    const community = await t.run(async (ctx) => ctx.db.get(communityId));
    expect(community!.calendarEditionIds).toContain(editionId);
  });

  it("moves edition from old community to new community on reassignment", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) =>
      ctx.db.insert("calendarEditions", {
        name: "Edition", code: "ED", orgId: "org_1", isDeleted: false,
      })
    );

    const oldCommunityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Old Community", slug: "old", orgId: "org_1",
        calendarEditionIds: [editionId], isDeleted: false,
      })
    );

    const newCommunityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "New Community", slug: "new", orgId: "org_1",
        calendarEditionIds: [], isDeleted: false,
      })
    );

    await t.mutation(api.calendarEditions.mutations.update, {
      id: editionId, name: "Edition", code: "ED", communityId: newCommunityId,
    });

    const oldCommunity = await t.run(async (ctx) => ctx.db.get(oldCommunityId));
    const newCommunity = await t.run(async (ctx) => ctx.db.get(newCommunityId));
    expect(oldCommunity!.calendarEditionIds).not.toContain(editionId);
    expect(newCommunity!.calendarEditionIds).toContain(editionId);
  });

  it("removes edition from community when communityId is empty string", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) =>
      ctx.db.insert("calendarEditions", {
        name: "Edition", code: "ED", orgId: "org_1", isDeleted: false,
      })
    );

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Community", slug: "comm", orgId: "org_1",
        calendarEditionIds: [editionId], isDeleted: false,
      })
    );

    await t.mutation(api.calendarEditions.mutations.update, {
      id: editionId, name: "Edition", code: "ED", removeCommunity: true,
    });

    const community = await t.run(async (ctx) => ctx.db.get(communityId));
    expect(community!.calendarEditionIds).not.toContain(editionId);
  });

  it("does not modify communities when neither communityId nor removeCommunity is provided", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.run(async (ctx) =>
      ctx.db.insert("calendarEditions", {
        name: "Edition", code: "ED", orgId: "org_1", isDeleted: false,
      })
    );

    const communityId = await t.run(async (ctx) =>
      ctx.db.insert("communities", {
        name: "Community", slug: "comm", orgId: "org_1",
        calendarEditionIds: [editionId], isDeleted: false,
      })
    );

    await t.mutation(api.calendarEditions.mutations.update, {
      id: editionId, name: "Updated", code: "ED",
    });

    const community = await t.run(async (ctx) => ctx.db.get(communityId));
    expect(community!.calendarEditionIds).toContain(editionId);
  });
});

describe("calendarEditions.mutations.softDelete", () => {
  it("marks the edition as deleted", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "To Delete", code: "DEL",
    });

    await t.mutation(api.calendarEditions.mutations.softDelete, { id: editionId });

    const deleted = await t.run(async (ctx) => ctx.db.get(editionId));
    expect(deleted!.isDeleted).toBe(true);
  });

  it("soft-deleted edition no longer appears in list queries", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const editionId = await t.mutation(api.calendarEditions.mutations.create, {
      orgId: "org_1", name: "Will Delete", code: "WD",
    });

    await t.mutation(api.calendarEditions.mutations.softDelete, { id: editionId });

    const results = await t.query(api.calendarEditions.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(0);
  });
});
