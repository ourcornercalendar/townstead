import { convexTest, type TestConvex } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { AD_STATUSES, AD_STATUS_LABELS } from "./adStatus";

/**
 * The artwork stage a business is at.
 *
 * Joyce scans these to know who she is waiting on, so the things worth
 * protecting are: every stage she named can actually be set, setting one does
 * not disturb anything else on the record, and the value is hers alone rather
 * than something another organisation can read or write.
 */

const ORG = "org_1";
const OTHER = "org_2";
const ADMIN = { subject: "joyce", orgId: ORG };

async function aBusiness(base: TestConvex<typeof schema>, orgId = ORG) {
  return await base.run(async (ctx) =>
    ctx.db.insert("contacts", {
      orgId,
      company: "Beach Hut Deli",
      firstName: "Sam",
      lastName: "Rivera",
      email: "sam@example.com",
      notes: "Prefers a call before the proof goes out.",
      isDeleted: false,
    })
  );
}

describe("setting the stage", () => {
  it("accepts every stage Joyce named", async () => {
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);
    const admin = base.withIdentity(ADMIN);

    for (const status of AD_STATUSES) {
      await admin.mutation(api.contacts.mutations.setAdStatus, {
        id,
        adStatus: status,
      });
      const contact = await base.run(async (ctx) => ctx.db.get(id));
      expect(contact!.adStatus).toBe(status);
    }
  });

  it("is the six stages, in Joyce's order", () => {
    expect(AD_STATUSES.map((s) => AD_STATUS_LABELS[s])).toEqual([
      "Requested",
      "Sent to Mark",
      "Sent to Client",
      "Changes",
      "Approved",
      "Placed",
    ]);
  });

  it("records when it last moved", async () => {
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);
    const before = Date.now();

    await base.withIdentity(ADMIN).mutation(api.contacts.mutations.setAdStatus, {
      id,
      adStatus: "approved",
    });

    const contact = await base.run(async (ctx) => ctx.db.get(id));
    expect(contact!.adStatusUpdatedAt).toBeGreaterThanOrEqual(before);
  });

  it("can be cleared again", async () => {
    // A new calendar season starts with nobody at any stage.
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);
    const admin = base.withIdentity(ADMIN);

    await admin.mutation(api.contacts.mutations.setAdStatus, {
      id,
      adStatus: "placed",
    });
    await admin.mutation(api.contacts.mutations.setAdStatus, {
      id,
      adStatus: null,
    });

    const contact = await base.run(async (ctx) => ctx.db.get(id));
    expect(contact!.adStatus).toBeUndefined();
    expect(contact!.adStatusUpdatedAt).toBeUndefined();
  });

  it("leaves the rest of the record alone", async () => {
    // It is set from a dropdown in a long list. Nothing else on the business
    // should move because somebody changed a status.
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);

    await base.withIdentity(ADMIN).mutation(api.contacts.mutations.setAdStatus, {
      id,
      adStatus: "changes",
    });

    const contact = await base.run(async (ctx) => ctx.db.get(id));
    expect(contact!.company).toBe("Beach Hut Deli");
    expect(contact!.email).toBe("sam@example.com");
    expect(contact!.notes).toBe("Prefers a call before the proof goes out.");
  });

  it("starts out unset rather than guessed at", async () => {
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);
    const contact = await base.run(async (ctx) => ctx.db.get(id));
    expect(contact!.adStatus).toBeUndefined();
  });
});

describe("it belongs to one organisation", () => {
  it("is refused when signed out", async () => {
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);
    await expect(
      base.mutation(api.contacts.mutations.setAdStatus, {
        id,
        adStatus: "requested",
      })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot be set on another organisation's business", async () => {
    const base = convexTest(schema, modules);
    const theirs = await aBusiness(base, OTHER);
    await expect(
      base.withIdentity(ADMIN).mutation(api.contacts.mutations.setAdStatus, {
        id: theirs,
        adStatus: "approved",
      })
    ).rejects.toThrow(/Not found/);

    const contact = await base.run(async (ctx) => ctx.db.get(theirs));
    expect(contact!.adStatus).toBeUndefined();
  });
});

describe("it travels to the screens Joyce looks at", () => {
  it("comes back on the business list", async () => {
    const base = convexTest(schema, modules);
    const id = await aBusiness(base);
    const admin = base.withIdentity(ADMIN);
    await admin.mutation(api.contacts.mutations.setAdStatus, {
      id,
      adStatus: "sent_to_client",
    });

    const list = await admin.query(api.contacts.queries.list, { orgId: ORG });
    expect(list.find((c) => c._id === id)?.adStatus).toBe("sent_to_client");
  });
});
