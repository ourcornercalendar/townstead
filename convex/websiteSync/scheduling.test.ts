import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * That the sync is actually queued.
 *
 * The mutations skip scheduling when no website is configured, so that a
 * development copy does not pile up jobs it can never run. That skip is one
 * typo away from switching the whole feature off on the live site without
 * anything appearing to be wrong, so it is worth a test of its own.
 */

// Marked for the website. Only advertisers Joyce has chosen are pushed at
// all -- the rule itself is covered in chosen.test.ts; these tests are about
// whether a push that *should* happen is actually queued.
const contact = {
  orgId: "org_1",
  company: "Pinot's Palette",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@pinots.example",
  showOnWebsite: true,
};

/**
 * The jobs sitting in Convex's queue.
 *
 * Written as a plain expression rather than a helper taking `t`: the harness
 * type convexTest returns is specific to this schema, and naming it in a
 * signature is more trouble than the two lines it saves.
 */
const QUEUE = "_scheduled_functions";

describe("scheduling the push to the website", () => {
  const original = process.env.WEBSITE_SUPABASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.WEBSITE_SUPABASE_URL;
    else process.env.WEBSITE_SUPABASE_URL = original;
  });

  describe("with a website configured", () => {
    beforeEach(() => {
      process.env.WEBSITE_SUPABASE_URL = "https://example.supabase.co";
      // Fake timers so the queued job does not fire mid-assertion; each test
      // drains it deliberately at the end.
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it("queues a push when an advertiser is added", async () => {
      const t = convexTest(schema, modules);
      await t.mutation(api.contacts.mutations.create, contact);

      const jobs = await t.run(async (ctx) => ctx.db.system.query(QUEUE).collect());
      expect(jobs).toHaveLength(1);
      expect(jobs[0].name).toContain("websiteSync/actions");
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    });

    it("queues a push when an advertiser is corrected", async () => {
      const t = convexTest(schema, modules);
      const id = await t.mutation(api.contacts.mutations.create, contact);
      await t.mutation(api.contacts.mutations.update, {
        id,
        company: "Pinot's Palette",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@pinots.example",
        phone: "916-555-0100",
        showOnWebsite: true,
      });

      expect(await t.run(async (ctx) => ctx.db.system.query(QUEUE).collect())).toHaveLength(2);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    });

    it("queues a push when an advertiser is deleted, so the website hides it", async () => {
      const t = convexTest(schema, modules);
      const id = await t.mutation(api.contacts.mutations.create, contact);
      await t.mutation(api.contacts.mutations.softDelete, { id });

      expect(await t.run(async (ctx) => ctx.db.system.query(QUEUE).collect())).toHaveLength(2);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    });
  });

  describe("with no website configured", () => {
    beforeEach(() => {
      delete process.env.WEBSITE_SUPABASE_URL;
    });

    it("queues nothing at all", async () => {
      const t = convexTest(schema, modules);
      await t.mutation(api.contacts.mutations.create, contact);
      expect(await t.run(async (ctx) => ctx.db.system.query(QUEUE).collect())).toHaveLength(0);
    });

    it("still saves the advertiser", async () => {
      // The point of scheduling rather than awaiting: the ad sales system
      // works whether or not the website is reachable or even configured.
      const t = convexTest(schema, modules);
      const id = await t.mutation(api.contacts.mutations.create, contact);
      const saved = await t.run(async (ctx) => ctx.db.get(id));
      expect(saved!.company).toBe("Pinot's Palette");
    });
  });
});
