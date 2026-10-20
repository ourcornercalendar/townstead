import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import type { Id } from "./_generated/dataModel";

describe("reallocateAllPayments", () => {
  it("reallocates a misallocated payment to the earliest-due installment", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const { purchaseId, sp1Id, sp2Id, paymentId } = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Test Co",
        firstName: "Jane",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
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
      });

      // March 2026 due first, January 2027 due later
      const sp1Id = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 2, 31).getTime(), // Mar 31, 2026
        amount: 45000,
        month: 3,
        year: 2026,
        orgId: "org_1",
      });

      const sp2Id = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2027, 0, 31).getTime(), // Jan 31, 2027
        amount: 45000,
        month: 1,
        year: 2027,
        orgId: "org_1",
      });

      const paymentId = await ctx.db.insert("payments", {
        purchaseId,
        amount: 45000,
        date: new Date(2026, 2, 20).getTime(), // Mar 20, 2026
        orgId: "org_1",
      });

      // Simulate v1 bug: payment incorrectly allocated to Jan 2027
      await ctx.db.insert("paymentAllocations", {
        paymentId,
        scheduledPaymentId: sp2Id,
        amount: 45000,
        orgId: "org_1",
      });

      return { purchaseId, sp1Id, sp2Id, paymentId };
    });

    const result = await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_1",
    });

    expect(result.purchasesProcessed).toBe(1);
    expect(result.allocationsDeleted).toBe(1);
    expect(result.allocationsCreated).toBe(1);

    // Verify the allocation now points to March (earliest due)
    const allocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp1Id as Id<"scheduledPayments">)
        )
        .collect();
    });

    expect(allocs).toHaveLength(1);
    expect(allocs[0].amount).toBe(45000);
    expect(allocs[0].paymentId).toBe(paymentId);

    // Verify Jan 2027 has no allocations
    const janAllocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp2Id as Id<"scheduledPayments">)
        )
        .collect();
    });

    expect(janAllocs).toHaveLength(0);
  });

  it("processes multiple payments in date order", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const { sp1Id, sp2Id } = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Multi Pay Co",
        firstName: "John",
        lastName: "Doe",
        orgId: "org_1",
        isDeleted: false,
      });

      const editionId = await ctx.db.insert("calendarEditions", {
        name: "2026",
        code: "26",
        orgId: "org_1",
      });

      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
      });

      const sp1Id = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 2, 31).getTime(),
        amount: 30000,
        month: 3,
        year: 2026,
        orgId: "org_1",
      });

      const sp2Id = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 3, 30).getTime(),
        amount: 30000,
        month: 4,
        year: 2026,
        orgId: "org_1",
      });

      // Two payments, no existing allocations
      await ctx.db.insert("payments", {
        purchaseId,
        amount: 30000,
        date: new Date(2026, 2, 15).getTime(),
        orgId: "org_1",
      });

      await ctx.db.insert("payments", {
        purchaseId,
        amount: 30000,
        date: new Date(2026, 3, 15).getTime(),
        orgId: "org_1",
      });

      return { sp1Id, sp2Id };
    });

    const result = await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_1",
    });

    expect(result.purchasesProcessed).toBe(1);
    expect(result.allocationsCreated).toBe(2);

    const sp1Allocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp1Id as Id<"scheduledPayments">)
        )
        .collect();
    });

    const sp2Allocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp2Id as Id<"scheduledPayments">)
        )
        .collect();
    });

    expect(sp1Allocs).toHaveLength(1);
    expect(sp1Allocs[0].amount).toBe(30000);
    expect(sp2Allocs).toHaveLength(1);
    expect(sp2Allocs[0].amount).toBe(30000);
  });

  it("skips purchases with no payments", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "No Payments Co",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
        isDeleted: false,
      });

      const editionId = await ctx.db.insert("calendarEditions", {
        name: "2026",
        code: "26",
        orgId: "org_1",
      });

      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
      });

      await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 2, 31).getTime(),
        amount: 10000,
        month: 3,
        year: 2026,
        orgId: "org_1",
      });
    });

    const result = await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_1",
    });

    expect(result.purchasesProcessed).toBe(0);
    expect(result.allocationsCreated).toBe(0);
    expect(result.allocationsDeleted).toBe(0);
  });

  it("isolates by orgId — does not touch other org's data", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_a" });

    const { orgBAllocId } = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Org B Co",
        firstName: "X",
        lastName: "Y",
        orgId: "org_b",
        isDeleted: false,
      });

      const editionId = await ctx.db.insert("calendarEditions", {
        name: "2026",
        code: "26",
        orgId: "org_b",
      });

      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_b",
      });

      const spId = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 2, 31).getTime(),
        amount: 20000,
        month: 3,
        year: 2026,
        orgId: "org_b",
      });

      const paymentId = await ctx.db.insert("payments", {
        purchaseId,
        amount: 20000,
        date: new Date(2026, 2, 20).getTime(),
        orgId: "org_b",
      });

      const orgBAllocId = await ctx.db.insert("paymentAllocations", {
        paymentId,
        scheduledPaymentId: spId,
        amount: 20000,
        orgId: "org_b",
      });

      return { orgBAllocId };
    });

    const result = await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_a",
    });

    expect(result.purchasesProcessed).toBe(0);

    // Org B's allocation should be untouched
    const orgBAlloc = await t.run(async (ctx) => {
      return await ctx.db.get(orgBAllocId as Id<"paymentAllocations">);
    });

    expect(orgBAlloc).not.toBeNull();
    expect(orgBAlloc!.amount).toBe(20000);
  });

  it("handles partial payments correctly", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const { sp1Id, sp2Id } = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Partial Pay Co",
        firstName: "P",
        lastName: "P",
        orgId: "org_1",
        isDeleted: false,
      });

      const editionId = await ctx.db.insert("calendarEditions", {
        name: "2026",
        code: "26",
        orgId: "org_1",
      });

      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
      });

      const sp1Id = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 2, 31).getTime(),
        amount: 50000,
        month: 3,
        year: 2026,
        orgId: "org_1",
      });

      const sp2Id = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 3, 30).getTime(),
        amount: 50000,
        month: 4,
        year: 2026,
        orgId: "org_1",
      });

      // Single $750 payment should fill March ($500) and partially fill April ($250)
      await ctx.db.insert("payments", {
        purchaseId,
        amount: 75000,
        date: new Date(2026, 2, 15).getTime(),
        orgId: "org_1",
      });

      return { sp1Id, sp2Id };
    });

    await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_1",
    });

    const sp1Allocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp1Id as Id<"scheduledPayments">)
        )
        .collect();
    });

    const sp2Allocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp2Id as Id<"scheduledPayments">)
        )
        .collect();
    });

    expect(sp1Allocs).toHaveLength(1);
    expect(sp1Allocs[0].amount).toBe(50000);
    expect(sp2Allocs).toHaveLength(1);
    expect(sp2Allocs[0].amount).toBe(25000);
  });

  it("is idempotent — running twice produces the same result", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Idempotent Co",
        firstName: "I",
        lastName: "D",
        orgId: "org_1",
        isDeleted: false,
      });

      const editionId = await ctx.db.insert("calendarEditions", {
        name: "2026",
        code: "26",
        orgId: "org_1",
      });

      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        orgId: "org_1",
      });

      await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 2, 31).getTime(),
        amount: 10000,
        month: 3,
        year: 2026,
        orgId: "org_1",
      });

      await ctx.db.insert("payments", {
        purchaseId,
        amount: 10000,
        date: new Date(2026, 2, 15).getTime(),
        orgId: "org_1",
      });
    });

    const result1 = await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_1",
    });

    const result2 = await asOrg.mutation(api.migration.reallocateAllPayments, {
      orgId: "org_1",
    });

    expect(result2.allocationsCreated).toBe(result1.allocationsCreated);

    // Should still have exactly 1 allocation total
    const allAllocs = await t.run(async (ctx) => {
      return await ctx.db
        .query("paymentAllocations")
        .withIndex("by_orgId", (q) => q.eq("orgId", "org_1"))
        .collect();
    });

    expect(allAllocs).toHaveLength(1);
    expect(allAllocs[0].amount).toBe(10000);
  });
});
