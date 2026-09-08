"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { RecordPaymentSheet } from "@/components/admin/record-payment-sheet";
import { PaymentScheduleModal } from "@/components/admin/payment-schedule-modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { byDisplayName } from "@/lib/sort-names";
import Link from "next/link";
import { DollarSign, CalendarDays } from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../../../convex/_generated/dataModel";

export interface ThisMonthRow {
  _id: string;
  purchaseId: string;
  dueDate: number;
  amount: number;
  paidAmount: number;
  status: "paid" | "partial" | "overdue" | "upcoming";
  invoiceNumber: string | null;
  contactName: string;
  company: string;
  contactId: string;
  contactEmail: string | null;
}

const statusConfig = {
  paid: { label: "Paid", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  partial: { label: "Partial", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  overdue: { label: "Overdue", variant: "destructive" as const },
  upcoming: { label: "Upcoming", variant: "secondary" as const },
} as const;

function ContactCell({ row }: { row: { original: ThisMonthRow } }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const displayName = row.original.company || row.original.contactName;

  return (
    <div className="flex items-start gap-1">
      <div className="flex-1">
        <p className="font-medium">{displayName}</p>
        {row.original.company && (
          <p className="text-xs text-muted-foreground">
            {row.original.contactName}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 shrink-0 p-0"
        onClick={(e) => {
          e.stopPropagation();
          setScheduleOpen(true);
        }}
        title="View payment schedule"
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </Button>
      <PaymentScheduleModal
        purchaseId={row.original.purchaseId}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title={`Payment Schedule — ${displayName}`}
      />
    </div>
  );
}

export const thisMonthColumns: ColumnDef<ThisMonthRow>[] = [
  {
    accessorKey: "contactName",
    // Compared the way a reader would file it, not the way bytes compare.
    // A plain string comparison puts every capital letter before every small
    // one, so "apex Signs" would sit after "Zeppole Bakery", and accented
    // names would be exiled to the end of the list.
    sortingFn: (a, b) => byDisplayName(a.original, b.original),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    cell: ({ row }) => <ContactCell row={row} />,
  },
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoice #" />
    ),
    cell: ({ row }) =>
      row.original.invoiceNumber ? (
        <Link
          href={`/admin/purchases/${row.original.purchaseId}`}
          className="text-primary hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Due Date" />
    ),
    cell: ({ row }) => formatDate(row.original.dueDate),
    sortingFn: "basic",
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount Due" />
    ),
    cell: ({ row }) => formatCurrency(row.original.amount),
  },
  {
    id: "paidAmount",
    accessorFn: (row) => row.paidAmount,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount Paid" />
    ),
    cell: ({ row }) => formatCurrency(row.original.paidAmount),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const config = statusConfig[row.original.status];
      if ("variant" in config) {
        return <Badge variant={config.variant}>{config.label}</Badge>;
      }
      return <Badge className={config.className}>{config.label}</Badge>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      if (row.original.status === "paid") return null;
      return <RecordPaymentAction row={row.original} />;
    },
  },
];

function RecordPaymentAction({ row }: { row: ThisMonthRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <DollarSign className="mr-1.5 h-3.5 w-3.5" />
        Record Payment
      </Button>
      <RecordPaymentSheet
        open={open}
        onOpenChange={setOpen}
        purchaseId={row.purchaseId as Id<"purchases">}
        contactName={row.contactName}
        company={row.company}
        invoiceNumber={row.invoiceNumber}
      />
    </>
  );
}
