import { convexTest, type TestConvex } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const ORG = "org_1";
const OTHER = "org_2";
const ADMIN = { subject: "joyce", orgId: ORG };

async function seed(
  base: TestConvex<typeof schema>,
  names: string[],
  orgId = ORG
) {
  return await base.run(async (ctx) =>
    Promise.all(
      names.map((name) =>
        ctx.db.insert("advertisements", {
          name,
          isDayType: false,
          slotsPerMonth: 1,
          orgId,
          isDeleted: false,
        })
      )
    )
  );
}

describe("the advertisement list comes back in order", () => {
  it("uses Joyce's order before anyone rearranges", async () => {
    const base = convexTest(schema, modules);
    await seed(base, ["Coupons", "Billboard", "Display"]);
    const list = await base
      .withIdentity(ADMIN)
      .query(api.advertisements.queries.list, { orgId: ORG });
    expect(list.map((a) => a.name)).toEqual([
      "Billboard",
      "Display",
      "Coupons",
    ]);
  });

  it("uses the arranged order afterwards", async () => {
    const base = convexTest(schema, modules);
    const ids = await seed(base, ["Billboard", "Display", "Coupons"]);
    const admin = base.withIdentity(ADMIN);

    await admin.mutation(api.advertisements.mutations.reorder, {
      orgId: ORG,
      orderedIds: [ids[2], ids[0], ids[1]],
    });

    const list = await admin.query(api.advertisements.queries.list, {
      orgId: ORG,
    });
    expect(list.map((a) => a.name)).toEqual([
      "Coupons",
      "Billboard",
      "Display",
    ]);
  });
});

describe("saving a new order", () => {
  it("numbers them from zero, closing any gaps", async () => {
    const base = convexTest(schema, modules);
    const ids = await seed(base, ["A", "B", "C"]);
    // Leave a deliberately silly set of existing numbers behind.
    await base.run(async (ctx) => {
      await ctx.db.patch(ids[0], { displayOrder: 50 });
      await ctx.db.patch(ids[1], { displayOrder: 50 });
    });

    await base
      .withIdentity(ADMIN)
      .mutation(api.advertisements.mutations.reorder, {
        orgId: ORG,
        orderedIds: ids,
      });

    const saved = await base.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id)))
    );
    expect(saved.map((a) => a!.displayOrder)).toEqual([0, 1, 2]);
  });

  it("is refused when not signed in", async () => {
    const base = convexTest(schema, modules);
    const ids = await seed(base, ["A"]);
    await expect(
      base.mutation(api.advertisements.mutations.reorder, {
        orgId: ORG,
        orderedIds: ids,
      })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("is refused for another organisation", async () => {
    const base = convexTest(schema, modules);
    const ids = await seed(base, ["A"]);
    await expect(
      base
        .withIdentity({ subject: "someone", orgId: OTHER })
        .mutation(api.advertisements.mutations.reorder, {
          orgId: ORG,
          orderedIds: ids,
        })
    ).rejects.toThrow(/Not authorized for this organization/);
  });

  it("refuses the whole list if one id belongs to someone else", async () => {
    // Half a reorder is worse than none: it would leave the list in an order
    // nobody chose, with no way to tell that is what happened.
    const base = convexTest(schema, modules);
    const mine = await seed(base, ["A", "B"]);
    const theirs = await seed(base, ["Theirs"], OTHER);

    await expect(
      base.withIdentity(ADMIN).mutation(api.advertisements.mutations.reorder, {
        orgId: ORG,
        orderedIds: [mine[0], theirs[0], mine[1]],
      })
    ).rejects.toThrow(/Not found/);

    const untouched = await base.run(async (ctx) =>
      Promise.all(mine.map((id) => ctx.db.get(id)))
    );
    expect(untouched.every((a) => a!.displayOrder === undefined)).toBe(true);
  });
});
