"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { useStableNow } from "@/hooks/use-stable-now";
import { DataTable } from "@/components/shared/data-table";
import { thisMonthColumns, type ThisMonthRow } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { BillingBulkEmailMenu } from "@/components/admin/billing-bulk-email-menu";

export default function ThisMonthPage() {
  const { orgId, isReady } = useOrg();
  const now = useStableNow();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const data = useQuery(
    api.billing.queries.listThisMonth,
    isReady ? { orgId: orgId!, now } : "skip"
  );

  const rows = (data ?? []) as ThisMonthRow[];

  const selectedBulkRows = useMemo(() => {
    return rows.filter((r) => rowSelection[r._id]);
  }, [rows, rowSelection]);

  if (!isReady || data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const overdueCount = data.filter((r) => r.status === "overdue").length;
  const upcomingCount = data.filter(
    (r) => r.status === "upcoming" || r.status === "partial"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BillingBulkEmailMenu
          selectedRows={selectedBulkRows.map((r) => ({
            purchaseId: r.purchaseId,
            contactId: r.contactId,
            contactEmail: r.contactEmail,
            displayName: r.company || r.contactName,
            invoiceNumber: r.invoiceNumber,
          }))}
          onComplete={() => setRowSelection({})}
        />

        <div className="flex items-center gap-2 text-sm">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-500/20 dark:text-red-300">
              {overdueCount} overdue
            </span>
          )}
          {upcomingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
              {upcomingCount} upcoming
            </span>
          )}
        </div>
      </div>

      <DataTable
        columns={thisMonthColumns}
        data={rows}
        searchKey="contactName"
        searchPlaceholder="Search by contact..."
        emptyTitle="No scheduled payments"
        emptyDescription="No payments due or overdue this month."
        initialSorting={[{ id: "contactName", desc: false }]}
        enableRowSelection
        getRowId={(row) => row._id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        noPagination
      />
    </div>
  );
}
