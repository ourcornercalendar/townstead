import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const ORG = "test_org";

describe("listByPurchase", () => {
  it("returns payments with allocations, sorted by date desc", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const purchaseId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme Inc",
        firstName: "Jane",
        lastName: "Doe",
        orgId: ORG,
        isDeleted: false,
        searchText: "Acme Inc Jane Doe",
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
      const spId = await ctx.db.insert("scheduledPayments", {
        purchaseId,
        dueDate: new Date(2026, 0, 1).getTime(),
        amount: 5000,
        month: 1,
        year: 2026,
        orgId: ORG,
      });
      const pay1Id = await ctx.db.insert("payments", {
        purchaseId,
        amount: 3000,
        date: new Date(2026, 0, 15).getTime(),
        method: "check",
        orgId: ORG,
      });
      const pay2Id = await ctx.db.insert("payments", {
        purchaseId,
        amount: 2000,
        date: new Date(2026, 1, 15).getTime(),
        method: "credit",
        orgId: ORG,
      });
      await ctx.db.insert("paymentAllocations", {
        paymentId: pay1Id,
        scheduledPaymentId: spId,
        amount: 3000,
        orgId: ORG,
      });
      return purchaseId;
    });

    const results = await t.query(api.payments.queries.listByPurchase, {
      purchaseId,
    });

    expect(results).toHaveLength(2);
    expect(results[0].amount).toBe(2000);
    expect(results[0].allocations).toHaveLength(0);
    expect(results[1].amount).toBe(3000);
    expect(results[1].allocations).toHaveLength(1);
    expect(results[1].allocations[0].amount).toBe(3000);
  });

  it("returns empty array when purchase has no payments", async () => {
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

    const results = await t.query(api.payments.queries.listByPurchase, {
      purchaseId,
    });
    expect(results).toHaveLength(0);
  });
});

describe("listByContact", () => {
  it("returns payments across purchases enriched with invoiceNumber and editionName, sorted by date desc", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const contactId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Acme Inc",
        firstName: "Jane",
        lastName: "Doe",
        orgId: ORG,
        isDeleted: false,
        searchText: "Acme Inc Jane Doe",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Spring 2026",
        code: "SP26",
        orgId: ORG,
        isDeleted: false,
      });
      const purchase1 = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        invoiceNumber: "26-0001",
        orgId: ORG,
        isDeleted: false,
      });
      const purchase2 = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [editionId],
        year: 2026,
        invoiceNumber: "26-0002",
        orgId: ORG,
        isDeleted: false,
      });
      await ctx.db.insert("payments", {
        purchaseId: purchase1,
        amount: 5000,
        date: new Date(2026, 0, 10).getTime(),
        orgId: ORG,
      });
      await ctx.db.insert("payments", {
        purchaseId: purchase2,
        amount: 3000,
        date: new Date(2026, 1, 10).getTime(),
        orgId: ORG,
      });
      return contactId;
    });

    const results = await t.query(api.payments.queries.listByContact, {
      contactId,
    });

    expect(results).toHaveLength(2);
    expect(results[0].amount).toBe(3000);
    expect(results[0].invoiceNumber).toBe("26-0002");
    expect(results[0].editionName).toBe("Spring 2026");
    expect(results[0].year).toBe(2026);
    expect(results[1].amount).toBe(5000);
    expect(results[1].invoiceNumber).toBe("26-0001");
    expect(results[1].editionName).toBe("Spring 2026");
  });

  it("excludes payments from soft-deleted purchases", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const contactId = await t.run(async (ctx) => {
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
        isDeleted: true,
      });
      await ctx.db.insert("payments", {
        purchaseId,
        amount: 5000,
        date: new Date(2026, 0, 10).getTime(),
        orgId: ORG,
      });
      return contactId;
    });

    const results = await t.query(api.payments.queries.listByContact, {
      contactId,
    });
    expect(results).toHaveLength(0);
  });

  it("shows 'Unknown' for editionName when purchase has no calendarEditionIds", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const contactId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Test Co",
        firstName: "John",
        lastName: "Smith",
        orgId: ORG,
        isDeleted: false,
        searchText: "Test Co John Smith",
      });
      const purchaseId = await ctx.db.insert("purchases", {
        contactId,
        calendarEditionIds: [],
        year: 2026,
        orgId: ORG,
        isDeleted: false,
      });
      await ctx.db.insert("payments", {
        purchaseId,
        amount: 1000,
        date: new Date(2026, 0, 5).getTime(),
        orgId: ORG,
      });
      return contactId;
    });

    const results = await t.query(api.payments.queries.listByContact, {
      contactId,
    });
    expect(results).toHaveLength(1);
    expect(results[0].editionName).toBe("Unknown");
  });
});
