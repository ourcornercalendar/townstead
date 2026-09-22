import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import {
  computeNet,
  computeAmountPaid,
  computeAmountPaidWithPrepaid,
  computeIsPaid,
  computeLateFees,
  computeScheduleBase,
  isScheduledPaymentLate,
  computeScheduledPaymentPaid,
} from "./helpers";
import { requireOrg } from "../auth.helpers";

export const listPayments = query({
  args: {
    orgId: v.string(),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    let payments: Doc<"payments">[];

    if (args.year) {
      const purchases = await ctx.db
        .query("purchases")
        .withIndex("by_orgId_and_year", (q) =>
          q.eq("orgId", args.orgId).eq("year", args.year!)
        )
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .collect();

      payments = [];
      for (const purchase of purchases) {
        const pp = await ctx.db
          .query("payments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();
        payments.push(...pp);
      }
    } else {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
        .collect();
    }

    const enriched = await Promise.all(
      payments.map(async (payment) => {
        const purchase = await ctx.db.get(payment.purchaseId);
        const contact = purchase
          ? await ctx.db.get(purchase.contactId)
          : null;

        return {
          _id: payment._id,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          checkNumber: payment.checkNumber,
          invoiceNumber: purchase?.invoiceNumber ?? null,
          purchaseId: payment.purchaseId,
          contactId: purchase?.contactId ?? null,
          contactEmail: contact?.email ?? null,
          contactName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unknown",
          company: contact?.company ?? "",
          year: purchase?.year ?? 0,
        };
      })
    );

    return enriched.sort((a, b) => b.date - a.date);
  },
});

export const listOwedPayments = query({
  args: {
    orgId: v.string(),
    year: v.optional(v.number()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    let purchases: Doc<"purchases">[];

    if (args.year) {
      purchases = await ctx.db
        .query("purchases")
        .withIndex("by_orgId_and_year", (q) =>
          q.eq("orgId", args.orgId).eq("year", args.year!)
        )
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .collect();
    } else {
      purchases = await ctx.db
        .query("purchases")
        .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .collect();
    }

    const rows = await Promise.all(
      purchases.map(async (purchase) => {
        const contact = await ctx.db.get(purchase.contactId);

        const terms = await ctx.db
          .query("paymentTerms")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .first();

        const scheduledPayments = await ctx.db
          .query("scheduledPayments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const allAllocations: Doc<"paymentAllocations">[] = [];
        for (const sp of scheduledPayments) {
          const spAllocs = await ctx.db
            .query("paymentAllocations")
            .withIndex("by_scheduledPaymentId", (q) =>
              q.eq("scheduledPaymentId", sp._id)
            )
            .collect();
          allAllocations.push(...spAllocs);
        }

        const purchasePayments = await ctx.db
          .query("payments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const net = terms
          ? computeNet(terms, scheduledPayments, allAllocations, args.now)
          : 0;
        const { amountPaid } = computeAmountPaidWithPrepaid(
          allAllocations,
          purchasePayments
        );
        if (computeIsPaid(net, amountPaid)) return null;

        const balance = Math.max(0, net - amountPaid);

        const sortedSp = [...scheduledPayments].sort(
          (a, b) => a.dueDate - b.dueDate
        );
        let nextDueDate: number | null = null;
        let nextDueIsLate = false;
        for (const sp of sortedSp) {
          const spPaid = computeScheduledPaymentPaid(sp._id, allAllocations);
          if (spPaid < sp.amount) {
            nextDueDate = sp.dueDate;
            nextDueIsLate = isScheduledPaymentLate(sp, allAllocations, args.now);
            break;
          }
        }

        return {
          _id: purchase._id,
          purchaseId: purchase._id,
          contactName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unknown",
          company: contact?.company ?? "",
          contactEmail: contact?.email ?? null,
          contactId: purchase.contactId,
          year: purchase.year,
          nextDueDate,
          nextDueIsLate,
          balance,
          invoiceNumber: purchase.invoiceNumber ?? null,
        };
      })
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) =>
        (a.company || a.contactName).localeCompare(b.company || b.contactName)
      );
  },
});

export const listThisMonth = query({
  args: {
    orgId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const now = args.now;
    const currentDate = new Date(now);
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const currentYearPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_orgId_and_year", (q) =>
        q.eq("orgId", args.orgId).eq("year", currentYear)
      )
      .collect();

    const allOrgPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const pastDueCandidates = allOrgPayments.filter(
      (sp) => sp.dueDate < now && sp.year < currentYear
    );

    const combined = [...currentYearPayments, ...pastDueCandidates];
    const uniqueSp = Array.from(
      new Map(combined.map((sp) => [sp._id, sp])).values()
    );

    const candidates = uniqueSp.filter((sp) => {
      if (sp.year === currentYear && sp.month === currentMonth) return true;
      if (sp.dueDate < now) return true;
      return false;
    });

    const enriched = await Promise.all(
      candidates.map(async (sp) => {
        const purchase = await ctx.db.get(sp.purchaseId);
        if (!purchase || purchase.isDeleted) return null;

        const contact = await ctx.db.get(purchase.contactId);

        const allocations = await ctx.db
          .query("paymentAllocations")
          .withIndex("by_scheduledPaymentId", (q) =>
            q.eq("scheduledPaymentId", sp._id)
          )
          .collect();

        const paidAmount = computeScheduledPaymentPaid(sp._id, allocations);
        const isLate = isScheduledPaymentLate(sp, allocations, now);

        let status: "paid" | "partial" | "overdue" | "upcoming";
        if (paidAmount >= sp.amount) {
          status = "paid";
        } else if (isLate) {
          status = "overdue";
        } else if (paidAmount > 0) {
          status = "partial";
        } else {
          status = "upcoming";
        }

        return {
          _id: sp._id,
          purchaseId: sp.purchaseId,
          dueDate: sp.dueDate,
          amount: sp.amount,
          month: sp.month,
          year: sp.year,
          paidAmount,
          status,
          invoiceNumber: purchase.invoiceNumber ?? null,
          contactName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unknown",
          company: contact?.company ?? "",
          contactId: purchase.contactId,
          contactEmail: contact?.email ?? null,
        };
      })
    );

    const isThisMonth = (row: { year: number; month: number }) =>
      row.year === currentYear && row.month === currentMonth;

    return enriched
      .filter((row): row is NonNullable<typeof row> => {
        if (row === null) return false;
        if (isThisMonth(row)) return true;
        return row.status !== "paid";
      })
      .sort((a, b) => a.dueDate - b.dueDate);
  },
});

export const getCashFlowReport = query({
  args: {
    orgId: v.string(),
    calendarEditionId: v.optional(v.id("calendarEditions")),
    year: v.number(),
    paymentYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const viewYear = args.paymentYear;

    const allPurchases = await ctx.db
      .query("purchases")
      .withIndex("by_orgId_and_year", (q) =>
        q.eq("orgId", args.orgId).eq("year", args.year)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const purchases = args.calendarEditionId
      ? allPurchases.filter((p) =>
          p.calendarEditionIds.includes(args.calendarEditionId!)
        )
      : allPurchases;

    type Cell = { projected: number; actual: number };
    type PurchaseDetail = {
      purchaseId: string;
      editionNames: string[];
      invoiceNumber: string | undefined;
      cells: Cell[];
      total: Cell;
    };

    const contactInfo = new Map<
      string,
      { contactName: string; company: string }
    >();
    const allKeys = new Set<string>();

    type PurchaseCellData = {
      purchaseId: string;
      editionNames: string[];
      invoiceNumber: string | undefined;
      cellMap: Map<string, Cell>;
      contactId: string;
    };

    const purchaseDataList: PurchaseCellData[] = [];

    for (const purchase of purchases) {
      const contact = await ctx.db.get(purchase.contactId);
      const cid = purchase.contactId.toString();

      if (!contactInfo.has(cid)) {
        contactInfo.set(cid, {
          contactName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unknown",
          company: contact?.company ?? "",
        });
      }

      const editionNames: string[] = [];
      for (const edId of purchase.calendarEditionIds) {
        const ed = await ctx.db.get(edId);
        if (ed) editionNames.push(ed.name);
      }

      const allSps = await ctx.db
        .query("scheduledPayments")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", purchase._id)
        )
        .collect();
      const sps =
        viewYear !== undefined
          ? allSps.filter((sp) => sp.year === viewYear)
          : allSps;

      const allPayments = await ctx.db
        .query("payments")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", purchase._id)
        )
        .collect();
      const payments =
        viewYear !== undefined
          ? allPayments.filter((p) => {
              const s = new Date(viewYear, 0, 1).getTime();
              const e = new Date(viewYear, 11, 31, 23, 59, 59, 999).getTime();
              return p.date >= s && p.date <= e;
            })
          : allPayments;

      const pCellMap = new Map<string, Cell>();

      for (const sp of sps) {
        const key = `${sp.year}-${String(sp.month).padStart(2, "0")}`;
        allKeys.add(key);
        const cell = pCellMap.get(key) ?? { projected: 0, actual: 0 };
        cell.projected += sp.amount;
        pCellMap.set(key, cell);
      }

      for (const payment of payments) {
        const d = new Date(payment.date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `${y}-${String(m).padStart(2, "0")}`;
        allKeys.add(key);
        const cell = pCellMap.get(key) ?? { projected: 0, actual: 0 };
        cell.actual += payment.amount;
        pCellMap.set(key, cell);
      }

      purchaseDataList.push({
        purchaseId: purchase._id.toString(),
        editionNames,
        invoiceNumber: purchase.invoiceNumber,
        cellMap: pCellMap,
        contactId: cid,
      });
    }

    const columns = Array.from(allKeys).sort();

    if (columns.length === 0 && viewYear !== undefined) {
      for (let m = 1; m <= 12; m++) {
        columns.push(`${viewYear}-${String(m).padStart(2, "0")}`);
      }
    } else if (columns.length === 0) {
      for (let m = 1; m <= 12; m++) {
        columns.push(`${args.year}-${String(m).padStart(2, "0")}`);
      }
    }

    type ContactRow = {
      contactId: string;
      contactName: string;
      company: string;
      cells: Cell[];
      total: Cell;
      purchases: PurchaseDetail[];
    };

    const contactRows = new Map<string, ContactRow>();

    for (const pd of purchaseDataList) {
      const pCells: Cell[] = columns.map((key) => {
        const c = pd.cellMap.get(key) ?? { projected: 0, actual: 0 };
        return { ...c };
      });

      const pTotal: Cell = {
        projected: pCells.reduce((s, c) => s + c.projected, 0),
        actual: pCells.reduce((s, c) => s + c.actual, 0),
      };

      if (pTotal.projected === 0 && pTotal.actual === 0) continue;

      const purchaseDetail: PurchaseDetail = {
        purchaseId: pd.purchaseId,
        editionNames: pd.editionNames,
        invoiceNumber: pd.invoiceNumber,
        cells: pCells,
        total: pTotal,
      };

      if (!contactRows.has(pd.contactId)) {
        const info = contactInfo.get(pd.contactId)!;
        contactRows.set(pd.contactId, {
          contactId: pd.contactId,
          contactName: info.contactName,
          company: info.company,
          cells: columns.map(() => ({ projected: 0, actual: 0 })),
          total: { projected: 0, actual: 0 },
          purchases: [],
        });
      }

      const row = contactRows.get(pd.contactId)!;
      row.purchases.push(purchaseDetail);

      for (let i = 0; i < columns.length; i++) {
        row.cells[i].projected += pCells[i].projected;
        row.cells[i].actual += pCells[i].actual;
      }
      row.total.projected += pTotal.projected;
      row.total.actual += pTotal.actual;
    }

    const rows = Array.from(contactRows.values());

    const summaryCells: Cell[] = columns.map((_, i) => {
      const cell: Cell = { projected: 0, actual: 0 };
      for (const row of rows) {
        cell.projected += row.cells[i].projected;
        cell.actual += row.cells[i].actual;
      }
      return cell;
    });
    const summaryTotal: Cell = {
      projected: summaryCells.reduce((s, c) => s + c.projected, 0),
      actual: summaryCells.reduce((s, c) => s + c.actual, 0),
    };

    return {
      columns,
      rows: rows.sort((a, b) =>
        (a.company || a.contactName).localeCompare(
          b.company || b.contactName
        )
      ),
      summary: { cells: summaryCells, total: summaryTotal },
    };
  },
});

export const getInvoiceData = query({
  args: {
    purchaseId: v.id("purchases"),
    orgId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.isDeleted || purchase.orgId !== args.orgId) {
      return null;
    }

    const contact = await ctx.db.get(purchase.contactId);
    const allEditions = await Promise.all(
      purchase.calendarEditionIds.map((id) => ctx.db.get(id))
    );
    const editionCodes = allEditions
      .filter(Boolean)
      .map((e) => e!.code)
      .join(", ") || "Unknown";
    const firstEdition = allEditions.find(Boolean) ?? null;

    const terms = await ctx.db
      .query("paymentTerms")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", purchase._id)
      )
      .first();

    const adPurchases = await ctx.db
      .query("adPurchases")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", purchase._id)
      )
      .collect();

    const lineItems = await Promise.all(
      adPurchases.map(async (ap) => {
        const ad = await ctx.db.get(ap.advertisementId);
        const apEdition = ap.calendarEditionId
          ? await ctx.db.get(ap.calendarEditionId)
          : firstEdition;

        const pricingEditionId = ap.calendarEditionId ?? purchase.calendarEditionIds[0];
        const pricing = pricingEditionId
          ? await ctx.db
              .query("adPricing")
              .withIndex(
                "by_advertisementId_and_calendarEditionId_and_year",
                (q) =>
                  q
                    .eq("advertisementId", ap.advertisementId)
                    .eq("calendarEditionId", pricingEditionId)
                    .eq("year", purchase.year)
              )
              .first()
          : null;

        const slots = await ctx.db
          .query("adSlots")
          .withIndex("by_adPurchaseId", (q) =>
            q.eq("adPurchaseId", ap._id)
          )
          .collect();

        let unitPrice = 0;
        let total = 0;
        if (pricing) {
          const monthPrices = Object.values(pricing.monthlyPrices);
          unitPrice = Math.round(
            monthPrices.reduce((s, p) => s + p, 0) / monthPrices.length
          );
          total = unitPrice * ap.quantity;
        } else if (ap.charge != null && ap.charge > 0) {
          total = ap.charge;
          unitPrice = ap.quantity > 0 ? Math.round(ap.charge / ap.quantity) : ap.charge;
        }

        return {
          _id: ap._id,
          advertisementName: ad?.name ?? "Unknown",
          isDayType: ad?.isDayType ?? false,
          quantity: ap.quantity,
          unitPrice,
          total,
          calendarName: apEdition?.code ?? firstEdition?.code ?? "",
          slots,
        };
      })
    );

    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) =>
        q.eq("purchaseId", purchase._id)
      )
      .collect();

    const allAllocations: Doc<"paymentAllocations">[] = [];
    for (const sp of scheduledPayments) {
      const spAllocs = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp._id)
        )
        .collect();
      allAllocations.push(...spAllocs);
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const net = terms
      ? computeNet(terms, scheduledPayments, allAllocations, args.now)
      : 0;
    const { amountPaid, prepaidAmount } = computeAmountPaidWithPrepaid(
      allAllocations,
      payments
    );

    const enrichedScheduledPayments = scheduledPayments
      .sort((a, b) => a.dueDate - b.dueDate)
      .map((sp) => ({
        ...sp,
        paidAmount: computeScheduledPaymentPaid(sp._id, allAllocations),
        isLate: isScheduledPaymentLate(sp, allAllocations, args.now),
      }));

    return {
      purchase,
      contact,
      editionCodes,
      terms,
      lineItems,
      net,
      amountPaid,
      prepaidAmount,
      balance: Math.max(0, net - amountPaid),
      scheduledPayments: enrichedScheduledPayments,
      payments: payments.sort((a, b) => a.date - b.date),
    };
  },
});

export const getStatementData = query({
  args: {
    contactId: v.id("contacts"),
    orgId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) return null;

    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_contactId", (q) =>
        q.eq("contactId", args.contactId)
      )
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const now = args.now;
    let overallBalance = 0;
    let latestStatementMessage: string | undefined;

    const purchaseRows = await Promise.all(
      purchases.map(async (purchase) => {
        const editions = await Promise.all(
          purchase.calendarEditionIds.map((id) => ctx.db.get(id))
        );
        const editionCode = editions
          .filter(Boolean)
          .map((e) => e!.code)
          .join(", ") || "Unknown";

        const terms = await ctx.db
          .query("paymentTerms")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .first();

        if (terms?.statementMessage) {
          latestStatementMessage = terms.statementMessage;
        }

        const scheduledPayments = await ctx.db
          .query("scheduledPayments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const allAllocations: Doc<"paymentAllocations">[] = [];
        for (const sp of scheduledPayments) {
          const spAllocs = await ctx.db
            .query("paymentAllocations")
            .withIndex("by_scheduledPaymentId", (q) =>
              q.eq("scheduledPaymentId", sp._id)
            )
            .collect();
          allAllocations.push(...spAllocs);
        }

        const purchasePayments = await ctx.db
          .query("payments")
          .withIndex("by_purchaseId", (q) =>
            q.eq("purchaseId", purchase._id)
          )
          .collect();

        const net = terms
          ? computeNet(terms, scheduledPayments, allAllocations, now)
          : 0;
        const { amountPaid } = computeAmountPaidWithPrepaid(
          allAllocations,
          purchasePayments
        );
        const balance = Math.max(0, net - amountPaid);
        overallBalance += balance;

        return {
          _id: purchase._id,
          invoiceNumber: purchase.invoiceNumber,
          editionName: editionCode,
          year: purchase.year,
          net,
          amountPaid,
          balance,
        };
      })
    );

    // Get all payments for this contact
    const allPayments = [];
    for (const purchase of purchases) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", purchase._id)
        )
        .collect();

      const editions = await Promise.all(
        purchase.calendarEditionIds.map((id) => ctx.db.get(id))
      );
      const editionCode = editions
        .filter(Boolean)
        .map((e) => e!.code)
        .join(", ") || "Unknown";

      for (const payment of payments) {
        allPayments.push({
          _id: payment._id,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          checkNumber: payment.checkNumber,
          invoiceNumber: purchase.invoiceNumber,
          editionName: editionCode,
          year: purchase.year,
        });
      }
    }

    return {
      contact,
      purchases: purchaseRows,
      payments: allPayments.sort((a, b) => b.date - a.date),
      overallBalance,
      statementMessage: latestStatementMessage,
    };
  },
});

/**
 * Per-purchase statement data matching v1's running-balance ledger format.
 * Returns chronologically interleaved late fees and payments with running balance.
 */
export const getStatementDataByPurchase = query({
  args: {
    purchaseId: v.id("purchases"),
    orgId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.isDeleted || purchase.orgId !== args.orgId) {
      return null;
    }

    const contact = await ctx.db.get(purchase.contactId);
    const allEditions = await Promise.all(
      purchase.calendarEditionIds.map((id) => ctx.db.get(id))
    );
    const editionCode = allEditions
      .filter(Boolean)
      .map((e) => e!.code)
      .join(", ") || "Unknown";

    const terms = await ctx.db
      .query("paymentTerms")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .first();

    const scheduledPayments = await ctx.db
      .query("scheduledPayments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const allAllocations: Doc<"paymentAllocations">[] = [];
    for (const sp of scheduledPayments) {
      const spAllocs = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_scheduledPaymentId", (q) =>
          q.eq("scheduledPaymentId", sp._id)
        )
        .collect();
      allAllocations.push(...spAllocs);
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
      .collect();

    const net = terms
      ? computeNet(terms, scheduledPayments, allAllocations, args.now)
      : 0;
    const { amountPaid } = computeAmountPaidWithPrepaid(
      allAllocations,
      payments
    );

    const prepaidTotal = payments
      .filter((p) => p.isPrepaid)
      .reduce((sum, p) => sum + p.amount, 0);

    // Compute late fee per occurrence
    let lateFeePerOccurrence = 0;
    if (terms?.lateFeeType && terms.lateFeeAmount) {
      lateFeePerOccurrence =
        terms.lateFeeType === "flat"
          ? terms.lateFeeAmount
          : Math.round(terms.totalSale * (terms.lateFeeAmount / 100));
    }

    // Count late fees already baked into net (for the starting balance)
    const totalLateFees = terms
      ? computeLateFees(terms, scheduledPayments, allAllocations, args.now)
      : 0;

    // Starting balance = net minus late fees minus prepaid (we add late fees back as ledger entries)
    const startingBalance = net - totalLateFees + prepaidTotal;

    // Build running-balance ledger entries
    type LedgerEntry = {
      date: number;
      description: string;
      amount: number;
      type: "charge" | "late_fee" | "payment";
    };

    const entries: LedgerEntry[] = [];

    // Late fee entries from scheduled payments
    for (const sp of scheduledPayments) {
      const isLate = isScheduledPaymentLate(sp, allAllocations, args.now);
      if (isLate && !sp.lateFeeWaived && lateFeePerOccurrence > 0) {
        entries.push({
          date: sp.dueDate,
          description: "Late Fee",
          amount: lateFeePerOccurrence,
          type: "late_fee",
        });
      }
    }

    // Payment entries (exclude prepaid since it's part of initial balance in v1)
    for (const p of payments) {
      if (p.isPrepaid) continue;
      const methodDesc = [
        p.method?.replace("_", " ") ?? "Deposit",
        p.checkNumber ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      entries.push({
        date: p.date,
        description: methodDesc,
        amount: p.amount,
        type: "payment",
      });
    }

    entries.sort((a, b) => a.date - b.date);

    // Compute past-due and next-payment for summary block
    let pastDueAmount = 0;
    for (const sp of scheduledPayments) {
      const isLate = isScheduledPaymentLate(sp, allAllocations, args.now);
      if (isLate) {
        const spPaid = computeScheduledPaymentPaid(sp._id, allAllocations);
        pastDueAmount += sp.amount - spPaid;
        if (!sp.lateFeeWaived && lateFeePerOccurrence > 0) {
          pastDueAmount += lateFeePerOccurrence;
        }
      }
    }

    // Next unpaid scheduled payment that is NOT already counted in pastDueAmount
    const sortedSp = [...scheduledPayments].sort(
      (a, b) => a.dueDate - b.dueDate
    );
    let nextPaymentDueDate = 0;
    let nextPaymentAmount = 0;
    for (const sp of sortedSp) {
      const spPaid = computeScheduledPaymentPaid(sp._id, allAllocations);
      if (spPaid < sp.amount) {
        if (!isScheduledPaymentLate(sp, allAllocations, args.now)) {
          nextPaymentDueDate = sp.dueDate;
          nextPaymentAmount = sp.amount - spPaid;
          break;
        }
      }
    }

    return {
      purchase,
      contact,
      editionCodes: editionCode,
      terms,
      invoiceNumber: purchase.invoiceNumber,
      year: purchase.year,
      editionName: editionCode,
      startingBalance,
      ledgerEntries: entries,
      pastDueAmount,
      nextPaymentDueDate,
      nextPaymentAmount,
      totalAmountDue: pastDueAmount + nextPaymentAmount,
      balance: Math.max(0, net - amountPaid),
    };
  },
});

export const auditScheduledPayments = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    const mismatches: Array<{
      purchaseId: string;
      contactName: string;
      company: string;
      year: number;
      invoiceNumber: string | null;
      scheduleBase: number;
      scheduledSum: number;
      scheduledCount: number;
      delta: number;
    }> = [];

    for (const purchase of purchases) {
      const terms = await ctx.db
        .query("paymentTerms")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", purchase._id)
        )
        .first();
      if (!terms) continue;

      const scheduledPayments = await ctx.db
        .query("scheduledPayments")
        .withIndex("by_purchaseId", (q) =>
          q.eq("purchaseId", purchase._id)
        )
        .collect();

      const scheduleBase = computeScheduleBase(terms);
      const scheduledSum = scheduledPayments.reduce(
        (s, sp) => s + sp.amount,
        0
      );

      if (Math.abs(scheduledSum - scheduleBase) > 1) {
        const contact = await ctx.db.get(purchase.contactId);
        mismatches.push({
          purchaseId: purchase._id,
          contactName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unknown",
          company: contact?.company ?? "",
          year: purchase.year,
          invoiceNumber: purchase.invoiceNumber ?? null,
          scheduleBase,
          scheduledSum,
          scheduledCount: scheduledPayments.length,
          delta: scheduleBase - scheduledSum,
        });
      }
    }

    return mismatches.sort((a, b) =>
      (a.company || a.contactName).localeCompare(b.company || b.contactName)
    );
  },
});
