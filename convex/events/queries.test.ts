import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("events.queries.list", () => {
  it("returns events for the given orgId", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Fall Festival",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const results = await t.query(api.events.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Fall Festival");
  });

  it("tenant isolation — org A cannot see org B events", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Org B Event",
        date: 1700000000000,
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await t.query(api.events.queries.list, { orgId: "org_a" });
    expect(results).toHaveLength(0);
  });

  it("excludes soft-deleted events", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Active Event",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("events", {
        name: "Deleted Event",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await t.query(api.events.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Active Event");
  });

  it("returns events where isDeleted is undefined (not set)", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "No Delete Flag",
        date: 1700000000000,
        orgId: "org_1",
      });
    });

    const results = await t.query(api.events.queries.list, { orgId: "org_1" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("No Delete Flag");
  });
});

describe("events.queries.getById", () => {
  it("returns the event by id", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Parade",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const event = await t.query(api.events.queries.getById, { id: eventId });
    expect(event).not.toBeNull();
    expect(event!.name).toBe("Parade");
    expect(event!.date).toBe(1700000000000);
  });
});

describe("events.queries.listByDateRange", () => {
  it("returns events within the date range for org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Before Range",
        date: 1000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("events", {
        name: "In Range",
        date: 5000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("events", {
        name: "After Range",
        date: 9000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const results = await t.query(api.events.queries.listByDateRange, {
      orgId: "org_1",
      startDate: 3000,
      endDate: 7000,
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("In Range");
  });

  it("excludes soft-deleted events within range", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Visible",
        date: 5000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("events", {
        name: "Deleted In Range",
        date: 5000,
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const results = await t.query(api.events.queries.listByDateRange, {
      orgId: "org_1",
      startDate: 1000,
      endDate: 9000,
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Visible");
  });

  it("tenant isolation — does not return other org events in range", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "Org B In Range",
        date: 5000,
        orgId: "org_b",
        isDeleted: false,
      });
    });

    const results = await t.query(api.events.queries.listByDateRange, {
      orgId: "org_a",
      startDate: 1000,
      endDate: 9000,
    });
    expect(results).toHaveLength(0);
  });

  it("includes events at range boundaries", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        name: "At Start",
        date: 3000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("events", {
        name: "At End",
        date: 7000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const results = await t.query(api.events.queries.listByDateRange, {
      orgId: "org_1",
      startDate: 3000,
      endDate: 7000,
    });
    expect(results).toHaveLength(2);
  });
});
