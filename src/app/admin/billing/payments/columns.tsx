"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Info, CalendarDays, DollarSign } from "lucide-react";
import { PaymentScheduleModal } from "@/components/admin/payment-schedule-modal";
import { RecordPaymentSheet } from "@/components/admin/record-payment-sheet";
import { byDisplayName } from "@/lib/sort-names";
import type { Id } from "../../../../../convex/_generated/dataModel";

export interface OwedPaymentRow {
  _id: string;
  purchaseId: string;
  contactName: string;
  company: string;
  contactEmail: string | null;
  contactId: string;
  year: number;
  nextDueDate: number | null;
  nextDueIsLate: boolean;
  balance: number;
  invoiceNumber: string | null;
}

function ContactCell({ row }: { row: { original: OwedPaymentRow } }) {
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

export const owedPaymentColumns: ColumnDef<OwedPaymentRow>[] = [
  {
    accessorKey: "contactName",
    // The cell shows the company when there is one, so the sort has to use
    // the same name. Sorting by contactName while displaying company made an
    // ordered list look unordered.
    sortingFn: (a, b) => byDisplayName(a.original, b.original),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    cell: ({ row }) => <ContactCell row={row} />,
  },
  {
    accessorKey: "contactEmail",
    header: "Email",
    cell: ({ row }) =>
      row.original.contactEmail ? (
        <span className="text-sm">{row.original.contactEmail}</span>
      ) : (
        <Badge variant="destructive" className="flex w-fit items-center gap-1">
          <Info className="h-3 w-3" />
          <span>No Email</span>
        </Badge>
      ),
  },
  {
    id: "year",
    accessorFn: (row) => String(row.year),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Calendar Year" />
    ),
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "nextDueDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Next Payment Due" />
    ),
    cell: ({ row }) => {
      const dueDate = row.original.nextDueDate;
      if (!dueDate) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-2">
          <span
            className={
              row.original.nextDueIsLate
                ? "text-destructive font-medium"
                : ""
            }
          >
            {formatDate(dueDate)}
          </span>
          {row.original.nextDueIsLate && (
            <Badge variant="destructive" className="text-xs">
              Late
            </Badge>
          )}
        </div>
      );
    },
    sortingFn: "basic",
  },
  {
    accessorKey: "balance",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Balance" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.balance)}</span>
    ),
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
    id: "actions",
    cell: ({ row }) => <RecordPaymentAction row={row.original} />,
  },
];

function RecordPaymentAction({ row }: { row: OwedPaymentRow }) {
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
