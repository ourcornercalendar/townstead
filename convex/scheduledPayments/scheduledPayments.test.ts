import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("scheduledPayments", () => {
  it("listByPurchase returns scheduled payments for a given purchase", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const purchaseId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
      });
      const pId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("scheduledPayments", {
        purchaseId: pId,
        dueDate: 1700000000000,
        amount: 10000,
        month: 1,
        year: 2026,
        orgId: "org_1",
      });
      await ctx.db.insert("scheduledPayments", {
        purchaseId: pId,
        dueDate: 1703000000000,
        amount: 10000,
        month: 2,
        year: 2026,
        orgId: "org_1",
      });
      return pId;
    });

    const results = await t.query(
      api.scheduledPayments.queries.listByPurchase,
      { purchaseId, now: 1710000000000 }
    );
    expect(results).toHaveLength(2);
    expect(results[0].dueDate).toBeLessThan(results[1].dueDate);
    expect(results[0].paidAmount).toBe(0);
    expect(results[0].isLate).toBeDefined();
  });

  it("listByPurchase enriches with paidAmount from allocations", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const purchaseId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
      });
      const pId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      const spId = await ctx.db.insert("scheduledPayments", {
        purchaseId: pId,
        dueDate: 1700000000000,
        amount: 10000,
        month: 1,
        year: 2026,
        orgId: "org_1",
      });
      const paymentId = await ctx.db.insert("payments", {
        purchaseId: pId,
        amount: 5000,
        date: 1699000000000,
        orgId: "org_1",
      });
      await ctx.db.insert("paymentAllocations", {
        paymentId,
        scheduledPaymentId: spId,
        amount: 5000,
        orgId: "org_1",
      });
      return pId;
    });

    const results = await t.query(
      api.scheduledPayments.queries.listByPurchase,
      { purchaseId, now: 1710000000000 }
    );
    expect(results).toHaveLength(1);
    expect(results[0].paidAmount).toBe(5000);
  });

  it("waiveLateFee toggles lateFeeWaived on a scheduled payment", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_1" });

    const spId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: "org_1",
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
        isDeleted: false,
      });
      return await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: 1700000000000,
        amount: 10000,
        month: 1,
        year: 2026,
        orgId: "org_1",
      });
    });

    await t.mutation(api.scheduledPayments.mutations.waiveLateFee, {
      id: spId,
      waived: true,
    });

    const doc = await t.run(async (ctx) => ctx.db.get(spId));
    expect(doc!.lateFeeWaived).toBe(true);

    await t.mutation(api.scheduledPayments.mutations.waiveLateFee, {
      id: spId,
      waived: false,
    });

    const updated = await t.run(async (ctx) => ctx.db.get(spId));
    expect(updated!.lateFeeWaived).toBe(false);
  });
});
