import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * The push itself, against a stand-in for the website.
 *
 * The pure pieces -- what a contact maps to, and which business it matches --
 * are covered in sync.test.ts. This covers the part that decides between them
 * and then writes: whether an existing business is updated or a new one
 * created, what is actually sent, and what is recorded when it fails. That
 * decision has real consequences on Joyce's live site, and until now nothing
 * exercised it.
 *
 * fetch is replaced rather than mocked at the module boundary, so the URL, the
 * method, the headers and the body are all asserted as the website would
 * receive them.
 */

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

/** A stand-in website. `rows` is what its business_profiles table holds. */
function fakeWebsite(options: { rows?: Record<string, unknown>[]; failWith?: number } = {}) {
  const calls: Call[] = [];
  const rows = options.rows ?? [];

  const fetchStub = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body, headers: (init.headers ?? {}) as Record<string, string> });

    if (options.failWith) {
      return new Response("permission denied for table business_profiles", {
        status: options.failWith,
      });
    }

    if (method === "GET") {
      // Answer the exact column=eq.value the sync asked about.
      const query = new URL(url).searchParams;
      const match = [...query.entries()].find(([k]) => k !== "select");
      if (!match) return new Response("[]", { status: 200 });
      const [column, raw] = match;
      const wanted = raw.replace(/^eq\./, "");
      return new Response(
        JSON.stringify(rows.filter((r) => String(r[column] ?? "") === wanted)),
        { status: 200 }
      );
    }

    if (method === "POST") return new Response(JSON.stringify([{ id: "new-business", ...body }]), { status: 201 });
    if (method === "PATCH") return new Response(JSON.stringify([{ id: "existing", ...body }]), { status: 200 });
    return new Response("[]", { status: 200 });
  });

  return { calls, fetchStub };
}

/**
 * The harness type, named via the call rather than written out: convexTest
 * returns a type specific to this schema, and `ReturnType<typeof convexTest>`
 * is a different, incompatible one.
 */
const makeHarness = () => convexTest(schema, modules);
type Harness = ReturnType<typeof makeHarness>;

// An advertiser Joyce has chosen to show. The push refuses to create anything
// for a contact that is not marked, which is the point of chosen.test.ts;
// these tests are about what it does for one that is.
const contactArgs = {
  orgId: "org_1",
  company: "Pinot's Palette",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@pinots.example",
  phone: "916-555-0100",
  showOnWebsite: true,
};

/**
 * Insert the contact straight into the database rather than through the
 * mutation. These tests are about the push, and going through the mutation
 * would queue a second push of its own -- the scheduling itself is covered in
 * scheduling.test.ts.
 */
async function seedContact(t: Harness) {
  return await t.run(async (ctx) =>
    ctx.db.insert("contacts", {
      ...contactArgs,
      searchText: contactArgs.company,
      isDeleted: false,
      updatedAt: Date.now(),
    })
  );
}

async function lastLog(t: Harness) {
  const rows = await t.run(async (ctx) => ctx.db.query("websiteSyncLog").collect());
  return rows[rows.length - 1];
}

describe("pushing one advertiser to the website", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.WEBSITE_SUPABASE_URL = "https://site.supabase.co";
    process.env.WEBSITE_SUPABASE_SERVICE_KEY = "service-key";
  });

  afterEach(() => {
    process.env = { ...original };
    vi.unstubAllGlobals();
  });

  it("creates a business when the website has never heard of it", async () => {
    const { calls, fetchStub } = fakeWebsite();
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    const contactId = await seedContact(t);
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    const post = calls.find((c) => c.method === "POST");
    expect(post).toBeDefined();
    expect(post!.url).toContain("/rest/v1/business_profiles");

    const sent = post!.body as Record<string, unknown>;
    expect(sent.name).toBe("Pinot's Palette");
    expect(sent.contact_email).toBe("jane@pinots.example");
    expect(sent.townstead_contact_id).toBe(contactId);
    // The whole point of the change after the directory incident.
    expect(sent.hidden).toBe(true);

    const log = await lastLog(t);
    expect(log.ok).toBe(true);
    expect(log.websiteBusinessId).toBe("new-business");
  });

  it("adopts a business that already has the same email, rather than duplicating it", async () => {
    const { calls, fetchStub } = fakeWebsite({
      rows: [{ id: "existing", name: "Pinot's Palette", contact_email: "jane@pinots.example" }],
    });
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    const contactId = await seedContact(t);
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    expect(calls.some((c) => c.method === "POST")).toBe(false);
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch).toBeDefined();
    expect(patch!.url).toContain("id=eq.existing");

    const sent = patch!.body as Record<string, unknown>;
    expect(sent.townstead_contact_id).toBe(contactId);
    // Never on an update: these belong to the website once it exists.
    expect(sent).not.toHaveProperty("hidden");
    expect(sent).not.toHaveProperty("category");
    expect(sent).not.toHaveProperty("photos");
  });

  it("does not publish a business the website is keeping hidden", async () => {
    // The imported advertisers are all hidden. An edit here must not undo that
    // -- that is the failure that put 815 strangers in the public directory.
    const { calls, fetchStub } = fakeWebsite({
      rows: [{ id: "existing", name: "Pinot's Palette", contact_email: "jane@pinots.example" }],
    });
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    const contactId = await seedContact(t);
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).not.toHaveProperty("hidden");
  });

  it("never takes over a business belonging to another advertiser", async () => {
    const { calls, fetchStub } = fakeWebsite({
      rows: [{
        id: "someone-elses", name: "Pinot's Palette",
        contact_email: "jane@pinots.example", townstead_contact_id: "a-different-contact",
      }],
    });
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    const contactId = await seedContact(t);
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("hides the website's copy when the advertiser is deleted here", async () => {
    const t = makeHarness();
    const contactId = await seedContact(t);

    // The website's row has to be built after the contact exists, so it can
    // carry the real link. An earlier version of this test used a placeholder
    // id, which made the row look like it belonged to a different advertiser
    // and quietly tested the create path instead of the delete path.
    const { calls, fetchStub } = fakeWebsite({
      rows: [{ id: "existing", name: "Pinot's Palette", townstead_contact_id: contactId }],
    });
    vi.stubGlobal("fetch", fetchStub);

    // Exactly what softDelete does: clears the email and marks it deleted.
    await t.run(async (ctx) => ctx.db.patch(contactId, { email: undefined, isDeleted: true }));
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch).toBeDefined();
    expect(patch!.body).toEqual({ hidden: true, updated_at: expect.any(String) });
    // Above all: it must not send the emptied email, which would unlink the
    // business from its owner's portal login.
    expect(patch!.body).not.toHaveProperty("contact_email");
  });

  it("does not create anything for an advertiser deleted before it ever synced", async () => {
    const { calls, fetchStub } = fakeWebsite();
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    const contactId = await seedContact(t);
    await t.run(async (ctx) => ctx.db.patch(contactId, { email: undefined, isDeleted: true }));
    calls.length = 0;
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect((await lastLog(t)).ok).toBe(true);
  });

  it("sends the service key, or the website would refuse the write", async () => {
    const { calls, fetchStub } = fakeWebsite();
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    await t.action(internal.websiteSync.actions.pushContact, { contactId: await seedContact(t) });

    expect(calls[0].headers.apikey).toBe("service-key");
    expect(calls[0].headers.Authorization).toBe("Bearer service-key");
  });

  it("records the reason when the website refuses, instead of failing quietly", async () => {
    const { fetchStub } = fakeWebsite({ failWith: 401 });
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    await t.action(internal.websiteSync.actions.pushContact, { contactId: await seedContact(t) });

    const log = await lastLog(t);
    expect(log.ok).toBe(false);
    expect(log.detail).toContain("401");
    // The message has to name the cause; "something went wrong" would leave
    // whoever reads this table no better off than the silence it replaced.
    expect(log.detail).toContain("permission denied");
  });

  it("records a failure rather than a false success when nothing is configured", async () => {
    delete process.env.WEBSITE_SUPABASE_URL;
    const { calls, fetchStub } = fakeWebsite();
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    await t.action(internal.websiteSync.actions.pushContact, { contactId: await seedContact(t) });

    expect(calls).toHaveLength(0);
    const log = await lastLog(t);
    expect(log.ok).toBe(false);
    expect(log.detail).toContain("no website configured");
  });

  it("keeps one row per advertiser, so the log says the current state", async () => {
    const { fetchStub } = fakeWebsite();
    vi.stubGlobal("fetch", fetchStub);

    const t = makeHarness();
    const contactId = await seedContact(t);
    await t.action(internal.websiteSync.actions.pushContact, { contactId });
    await t.action(internal.websiteSync.actions.pushContact, { contactId });

    const rows = await t.run(async (ctx) => ctx.db.query("websiteSyncLog").collect());
    expect(rows).toHaveLength(1);
  });
});
