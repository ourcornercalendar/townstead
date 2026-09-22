import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ORG = "test_org";

async function seedPurchaseWithSchedule(ctx: { db: any }) {
  const contactId = await ctx.db.insert("contacts", {
    company: "Acme",
    firstName: "Jane",
    lastName: "Doe",
    orgId: ORG,
    isDeleted: false,
    searchText: "Acme Jane Doe",
  });
  const editionId = await ctx.db.insert("calendarEditions", {
    name: "Spring 2026",
    code: "SP26",
    orgId: ORG,
    isDeleted: false,
  });
  const purchaseId = await ctx.db.insert("purchases", {
    contactId,
    calendarEditionIds: [editionId],
    year: 2026,
    orgId: ORG,
    isDeleted: false,
  });
  await ctx.db.insert("scheduledPayments", {
    purchaseId,
    dueDate: new Date(2026, 0, 1).getTime(),
    amount: 5000,
    month: 1,
    year: 2026,
    orgId: ORG,
  });
  await ctx.db.insert("scheduledPayments", {
    purchaseId,
    dueDate: new Date(2026, 1, 1).getTime(),
    amount: 5000,
    month: 2,
    year: 2026,
    orgId: ORG,
  });
  return purchaseId;
}

describe("recordPayment", () => {
  it("inserts payment and creates allocations filling earliest-due first", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const purchaseId = await t.run(async (ctx) => {
      return await seedPurchaseWithSchedule(ctx);
    });

    const paymentId = await t.mutation(api.payments.mutations.recordPayment, {
      purchaseId,
      amount: 7000,
      date: new Date(2026, 0, 15).getTime(),
      method: "check",
      orgId: ORG,
    });

    const payment = await t.run(async (ctx) => {
      return await ctx.db.get(paymentId);
    });
    expect(payment).not.toBeNull();
    expect(payment!.amount).toBe(7000);
    expect(payment!.method).toBe("check");

    const allocations = await t.run(async (ctx) => {
      const allocs = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q: any) => q.eq("paymentId", paymentId))
        .collect();
      const result = [];
      for (const a of allocs) {
        const sp = await ctx.db.get(a.scheduledPaymentId);
        result.push({ amount: a.amount, spMonth: sp!.month });
      }
      return result;
    });

    expect(allocations).toHaveLength(2);
    const janAlloc = allocations.find((a: any) => a.spMonth === 1);
    const febAlloc = allocations.find((a: any) => a.spMonth === 2);
    expect(janAlloc!.amount).toBe(5000);
    expect(febAlloc!.amount).toBe(2000);
  });

  it("creates no allocations when no scheduled payments exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const purchaseId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: ORG,
        isDeleted: false,
        searchText: "Acme Jane Doe",
      });
      return await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [],
        year: 2026,
        orgId: ORG,
        isDeleted: false,
      });
    });

    const paymentId = await t.mutation(api.payments.mutations.recordPayment, {
      purchaseId,
      amount: 5000,
      date: new Date(2026, 0, 15).getTime(),
      orgId: ORG,
    });

    const allocations = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q: any) => q.eq("paymentId", paymentId))
        .collect();
    });
    expect(allocations).toHaveLength(0);
  });
});

describe("updatePayment", () => {
  it("deletes old allocations, patches payment, and creates new allocations", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const purchaseId = await t.run(async (ctx) => {
      return await seedPurchaseWithSchedule(ctx);
    });

    const paymentId = await t.mutation(api.payments.mutations.recordPayment, {
      purchaseId,
      amount: 3000,
      date: new Date(2026, 0, 15).getTime(),
      orgId: ORG,
    });

    await t.mutation(api.payments.mutations.updatePayment, {
      id: paymentId,
      amount: 8000,
      date: new Date(2026, 0, 20).getTime(),
      method: "wire",
    });

    const payment = await t.run(async (ctx) => {
      return await ctx.db.get(paymentId);
    });
    expect(payment!.amount).toBe(8000);
    expect(payment!.method).toBe("wire");
    expect(payment!.date).toBe(new Date(2026, 0, 20).getTime());

    const allocations = await t.run(async (ctx) => {
      const allocs = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q: any) => q.eq("paymentId", paymentId))
        .collect();
      const result = [];
      for (const a of allocs) {
        const sp = await ctx.db.get(a.scheduledPaymentId);
        result.push({ amount: a.amount, spMonth: sp!.month });
      }
      return result;
    });

    expect(allocations).toHaveLength(2);
    const janAlloc = allocations.find((a: any) => a.spMonth === 1);
    const febAlloc = allocations.find((a: any) => a.spMonth === 2);
    expect(janAlloc!.amount).toBe(5000);
    expect(febAlloc!.amount).toBe(3000);
  });

  it("throws when payment does not exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const paymentId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: ORG,
        isDeleted: false,
        searchText: "Acme Jane Doe",
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [],
        year: 2026,
        orgId: ORG,
        isDeleted: false,
      });
      const id = await ctx.db.insert("payments", {
        purchaseId,
        amount: 1000,
        date: Date.now(),
        orgId: ORG,
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.mutation(api.payments.mutations.updatePayment, {
        id: paymentId,
        amount: 2000,
        date: Date.now(),
      })
    ).rejects.toThrowError("Payment not found");
  });
});

describe("deletePayment", () => {
  it("deletes allocations then deletes the payment", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const purchaseId = await t.run(async (ctx) => {
      return await seedPurchaseWithSchedule(ctx);
    });

    const paymentId = await t.mutation(api.payments.mutations.recordPayment, {
      purchaseId,
      amount: 5000,
      date: new Date(2026, 0, 15).getTime(),
      orgId: ORG,
    });

    const beforeAllocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q: any) => q.eq("paymentId", paymentId))
        .collect();
    });
    expect(beforeAllocs).toHaveLength(1);

    await t.mutation(api.payments.mutations.deletePayment, { id: paymentId });

    const payment = await t.run(async (ctx) => {
      return await ctx.db.get(paymentId);
    });
    expect(payment).toBeNull();

    const afterAllocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q: any) => q.eq("paymentId", paymentId))
        .collect();
    });
    expect(afterAllocs).toHaveLength(0);
  });

  it("throws when payment does not exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const paymentId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        orgId: ORG,
        isDeleted: false,
        searchText: "Acme Jane Doe",
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [],
        year: 2026,
        orgId: ORG,
        isDeleted: false,
      });
      const id = await ctx.db.insert("payments", {
        purchaseId,
        amount: 1000,
        date: Date.now(),
        orgId: ORG,
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.mutation(api.payments.mutations.deletePayment, { id: paymentId })
    ).rejects.toThrowError("Payment not found");
  });
});
