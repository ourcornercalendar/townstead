import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("events.mutations.create", () => {
  it("inserts an event with required fields", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Summer Bash",
      date: 1720000000000,
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get(eventId);
    });

    expect(event).not.toBeNull();
    expect(event!.name).toBe("Summer Bash");
    expect(event!.date).toBe(1720000000000);
    expect(event!.orgId).toBe("org_1");
    expect(event!.isDeleted).toBe(false);
  });

  it("inserts an event with all optional fields", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.mutation(api.events.mutations.create, {
      orgId: "org_1",
      name: "Detailed Event",
      date: 1720000000000,
      endDate: 1720100000000,
      description: "A great event",
      startTime: "09:00",
      endTime: "17:00",
      isYearly: true,
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get(eventId);
    });

    expect(event!.description).toBe("A great event");
    expect(event!.startTime).toBe("09:00");
    expect(event!.endTime).toBe("17:00");
    expect(event!.isYearly).toBe(true);
    expect(event!.endDate).toBe(1720100000000);
  });
});

describe("events.mutations.update", () => {
  it("patches event fields", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Original",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await t.mutation(api.events.mutations.update, {
      id: eventId,
      name: "Updated Name",
      date: 1700000000000,
      description: "Now with description",
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get(eventId);
    });

    expect(event!.name).toBe("Updated Name");
    expect(event!.description).toBe("Now with description");
  });
});

describe("events.mutations.softDelete", () => {
  it("marks event as isDeleted=true", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "To Delete",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await t.mutation(api.events.mutations.softDelete, { id: eventId });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get(eventId);
    });
    expect(event!.isDeleted).toBe(true);
  });

  it("soft-deleted event is excluded from list query", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Will Be Deleted",
        date: 1700000000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const beforeDelete = await t.query(api.events.queries.list, {
      orgId: "org_1",
    });
    expect(beforeDelete).toHaveLength(1);

    await t.mutation(api.events.mutations.softDelete, { id: eventId });

    const afterDelete = await t.query(api.events.queries.list, {
      orgId: "org_1",
    });
    expect(afterDelete).toHaveLength(0);
  });
});
