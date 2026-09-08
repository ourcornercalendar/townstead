"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { MoreHorizontal, Eye, Pencil, Trash2, DollarSign } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RecordPaymentSheet } from "@/components/admin/record-payment-sheet";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { byDisplayName } from "@/lib/sort-names";
import type { Id } from "../../../../convex/_generated/dataModel";

interface PurchaseRow {
  _id: string;
  invoiceNumber?: string;
  contactName: string;
  company: string;
  editionCode: string;
  year: number;
  net: number;
  amountPaid: number;
  isPaid: boolean;
  hasLate: boolean;
  hasSubmittedArtwork?: boolean;
}

function computeStatus(row: PurchaseRow): string {
  if (row.isPaid) return "paid";
  if (row.hasLate) return "overdue";
  if (row.amountPaid > 0) return "partial";
  return "unpaid";
}

const statusDisplay: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-500/20 dark:text-green-300" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300" },
  partial: { label: "Partial", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-500/20 dark:text-yellow-300" },
  unpaid: { label: "Unpaid", className: "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-500/20 dark:text-gray-300" },
};

function StatusBadge({ status }: { status: string }) {
  const display = statusDisplay[status] ?? statusDisplay.unpaid;
  return (
    <Badge className={display.className}>
      {display.label}
    </Badge>
  );
}

function ArtworkCell({ row }: { row: { original: PurchaseRow } }) {
  const toggleArtwork = useMutation(
    api.purchases.mutations.toggleArtworkSubmitted
  );
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doToggle = useCallback(
    async (value: boolean) => {
      setPending(true);
      try {
        await toggleArtwork({
          id: row.original._id as Id<"purchases">,
          hasSubmittedArtwork: value,
        });
      } catch {
        toast.error("Failed to update artwork status");
      } finally {
        setPending(false);
      }
    },
    [toggleArtwork, row.original._id]
  );

  const handleChange = (checked: boolean) => {
    if (!checked) {
      setConfirmOpen(true);
    } else {
      doToggle(true);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Switch
        checked={row.original.hasSubmittedArtwork ?? false}
        onCheckedChange={handleChange}
        disabled={pending}
        className={pending ? "opacity-50" : undefined}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove Artwork Submission?"
        description="This will mark the artwork as not submitted. Are you sure?"
        onConfirm={() => {
          setConfirmOpen(false);
          doToggle(false);
        }}
        confirmLabel="Confirm"
        variant="destructive"
      />
    </div>
  );
}

function ActionsCell({ row }: { row: { original: PurchaseRow } }) {
  const router = useRouter();
  const softDelete = useMutation(api.purchases.mutations.softDelete);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await softDelete({ id: row.original._id as Id<"purchases"> });
      toast.success("Purchase deleted");
    } catch {
      toast.error("Failed to delete purchase");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              router.push(`/admin/purchases/${row.original._id}`)
            }
          >
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/admin/purchases/${row.original._id}/edit`)
            }
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPaymentOpen(true)}>
            <DollarSign className="mr-2 h-4 w-4" />
            Record Payment
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RecordPaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        purchaseId={row.original._id as Id<"purchases">}
        contactName={row.original.contactName}
        company={row.original.company}
        invoiceNumber={row.original.invoiceNumber}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Purchase"
        description={`Are you sure you want to delete invoice ${row.original.invoiceNumber ?? "this purchase"}? This will remove all associated payments, allocations, and slot assignments.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
        loading={loading}
      />
    </div>
  );
}

export function purchaseColumns({
  yearOptions,
}: {
  yearOptions: { label: string; value: string }[];
}): ColumnDef<PurchaseRow>[] {
  return [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice #" />
      ),
    },
    {
      id: "contactName",
      accessorFn: (row) => `${row.company || row.contactName} ${row.contactName}`,
      sortingFn: (rowA, rowB) => byDisplayName(rowA.original, rowB.original),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact" />
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.company || row.original.contactName}
          </p>
          {row.original.company && row.original.contactName && (
            <p className="text-xs text-muted-foreground">
              {row.original.contactName}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "editionCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Edition" />
      ),
    },
    {
      id: "year",
      accessorFn: (row) => String(row.year),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Edition Year" />
      ),
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      meta: {
        filterOptions: yearOptions,
      },
    },
    {
      accessorKey: "net",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Net" />
      ),
      cell: ({ row }) => formatCurrency(row.original.net),
    },
    {
      accessorKey: "amountPaid",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Paid" />
      ),
      cell: ({ row }) => formatCurrency(row.original.amountPaid),
    },
    {
      id: "status",
      accessorFn: (row) => computeStatus(row),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      meta: {
        filterOptions: [
          { label: "Paid", value: "paid" },
          { label: "Partial", value: "partial" },
          { label: "Overdue", value: "overdue" },
          { label: "Unpaid", value: "unpaid" },
        ],
      },
    },
    {
      id: "artworkSubmitted",
      accessorFn: (row) =>
        row.hasSubmittedArtwork ? "true" : "false",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Artwork" />
      ),
      cell: ({ row }) => <ArtworkCell row={row} />,
      filterFn: (row, id, value: string[]) =>
        value.includes(row.getValue(id)),
      meta: {
        filterOptions: [
          { label: "Submitted", value: "true" },
          { label: "Not Submitted", value: "false" },
        ],
      },
    },
    {
      id: "actions",
      cell: ({ row }) => <ActionsCell row={row} />,
    },
  ];
}
