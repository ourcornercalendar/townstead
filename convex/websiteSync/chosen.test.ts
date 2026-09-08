import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * Joyce decides who appears on the website.
 *
 * The ad sales contact list is a sales list built over years -- prospects,
 * lapsed advertisers, people who bought once in 2023. Pushing all of it to the
 * public business directory would repeat the incident where 815 imported
 * businesses appeared at once, just more quietly: hundreds of hidden rows for
 * her to read past to find the handful that matter.
 *
 * So a business reaches the website only because she ticked a box, and the
 * rule is enforced twice -- in the mutations, so an ordinary save of anyone
 * else queues no work at all, and in the sync action, so a backfill cannot
 * push the whole list across either.
 *
 * These tests watch the scheduler rather than the website: what matters is
 * whether the push is even attempted.
 */

const advertiser = {
  orgId: "org_1",
  firstName: "Sam",
  lastName: "Reyes",
  company: "Corner Bakery",
  email: "sam@cornerbakery.example",
};

/** The sync only queues work when a website is configured. */
beforeEach(() => {
  vi.stubEnv("WEBSITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("WEBSITE_SUPABASE_SERVICE_KEY", "test-key");
  // Fake timers so a queued job never fires mid-assertion and tries to reach
  // a website that does not exist. What is being tested is whether the push
  // was queued at all, not what it would have sent.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/**
 * The pushes sitting in Convex's queue.
 *
 * Written as a factory rather than a helper taking the harness: the type
 * convexTest returns is specific to this schema, and naming it in a signature
 * costs more than the line it saves.
 */
const makeHarness = () => convexTest(schema, modules);
type Harness = ReturnType<typeof makeHarness>;

async function scheduledPushes(t: Harness) {
  return await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    return jobs.filter((j) => j.name.includes("websiteSync"));
  });
}

describe("only the advertisers Joyce chooses reach the website", () => {
  it("sends nothing when a prospect is added", async () => {
    const t = makeHarness();
    await t.mutation(api.contacts.mutations.create, advertiser);

    expect(await scheduledPushes(t)).toHaveLength(0);
  });

  it("sends nothing when the box is explicitly unticked", async () => {
    const t = makeHarness();
    await t.mutation(api.contacts.mutations.create, {
      ...advertiser,
      showOnWebsite: false,
    });

    expect(await scheduledPushes(t)).toHaveLength(0);
  });

  it("sends the business when the box is ticked", async () => {
    const t = makeHarness();
    await t.mutation(api.contacts.mutations.create, {
      ...advertiser,
      showOnWebsite: true,
    });

    expect(await scheduledPushes(t)).toHaveLength(1);
  });

  it("keeps quiet when an unshown advertiser is edited", async () => {
    // Correcting a note on a lapsed customer is not website business.
    const t = makeHarness();
    const id = await t.mutation(api.contacts.mutations.create, advertiser);

    await t.mutation(api.contacts.mutations.update, {
      id,
      company: advertiser.company,
      firstName: advertiser.firstName,
      lastName: advertiser.lastName,
      email: advertiser.email,
      phone: "916-555-0100",
    });

    expect(await scheduledPushes(t)).toHaveLength(0);
  });

  it("sends the change when a shown advertiser is edited", async () => {
    const t = makeHarness();
    const id = await t.mutation(api.contacts.mutations.create, {
      ...advertiser,
      showOnWebsite: true,
    });

    await t.mutation(api.contacts.mutations.update, {
      id,
      company: advertiser.company,
      firstName: advertiser.firstName,
      lastName: advertiser.lastName,
      email: advertiser.email,
      phone: "916-555-0100",
      showOnWebsite: true,
    });

    expect((await scheduledPushes(t)).length).toBeGreaterThanOrEqual(2);
  });

  it("still sends the save that takes a business OFF the website", async () => {
    // The one that would be easy to get wrong. If unticking queued nothing,
    // the business would stay published on the website forever.
    const t = makeHarness();
    const id = await t.mutation(api.contacts.mutations.create, {
      ...advertiser,
      showOnWebsite: true,
    });
    const afterCreate = (await scheduledPushes(t)).length;

    await t.mutation(api.contacts.mutations.update, {
      id,
      company: advertiser.company,
      firstName: advertiser.firstName,
      lastName: advertiser.lastName,
      email: advertiser.email,
      showOnWebsite: false,
    });

    expect((await scheduledPushes(t)).length).toBeGreaterThan(afterCreate);
  });

  it("does not chase a deletion that was never on the website", async () => {
    const t = makeHarness();
    const id = await t.mutation(api.contacts.mutations.create, advertiser);

    await t.mutation(api.contacts.mutations.softDelete, { id });

    expect(await scheduledPushes(t)).toHaveLength(0);
  });

  it("hides a shown business when it is deleted here", async () => {
    const t = makeHarness();
    const id = await t.mutation(api.contacts.mutations.create, {
      ...advertiser,
      showOnWebsite: true,
    });
    const afterCreate = (await scheduledPushes(t)).length;

    await t.mutation(api.contacts.mutations.softDelete, { id });

    expect((await scheduledPushes(t)).length).toBeGreaterThan(afterCreate);
  });

  it("remembers the choice on the contact itself", async () => {
    const t = makeHarness();
    const id = await t.mutation(api.contacts.mutations.create, {
      ...advertiser,
      showOnWebsite: true,
    });

    const saved = await t.run(async (ctx) => ctx.db.get(id));
    expect(saved!.showOnWebsite).toBe(true);
  });
});
