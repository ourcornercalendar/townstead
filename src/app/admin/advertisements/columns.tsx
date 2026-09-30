"use client";

import { type ColumnDef } from "@tanstack/react-table";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, DollarSign, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Advertisement = Doc<"advertisements">;

function ActionsCell({
  row,
  onPricing,
}: {
  row: { original: Advertisement };
  onPricing: (ad: Advertisement) => void;
}) {
  const softDelete = useMutation(api.advertisements.mutations.softDelete);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await softDelete({ id: row.original._id });
      toast.success("Advertisement deleted");
    } catch {
      toast.error("Failed to delete advertisement");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPricing(row.original)}>
            <DollarSign className="mr-2 h-4 w-4" />
            Set Pricing
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
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Advertisement"
        description={`Are you sure you want to delete "${row.original.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
        loading={loading}
      />
    </>
  );
}

/**
 * Up and down arrows for the running order.
 *
 * Disabled, rather than hidden, while a column sort is active: moving a row
 * "up" is meaningless when the rows on screen are not in the stored order,
 * and a button that silently does something other than what it looks like is
 * worse than one that is plainly unavailable.
 */
function OrderCell({
  row,
  onMove,
  sortingActive,
}: {
  row: { index: number };
  onMove: (index: number, direction: -1 | 1) => void;
  sortingActive: boolean;
}) {
  const title = sortingActive
    ? "Clear the column sort to rearrange"
    : undefined;
  return (
    <div className="flex flex-col -my-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-6"
        disabled={sortingActive}
        title={title}
        aria-label="Move up"
        onClick={() => onMove(row.index, -1)}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-6"
        disabled={sortingActive}
        title={title}
        aria-label="Move down"
        onClick={() => onMove(row.index, 1)}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function columns({
  onPricing,
  onMove,
  sortingActive = false,
}: {
  onPricing: (ad: Advertisement) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  sortingActive?: boolean;
}): ColumnDef<Advertisement>[] {
  return [
    ...(onMove
      ? [
          {
            id: "order",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { index: number } }) => (
              <OrderCell
                row={row}
                onMove={onMove}
                sortingActive={sortingActive}
              />
            ),
          } as ColumnDef<Advertisement>,
        ]
      : []),
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "isDayType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <Badge
          className={
            row.original.isDayType
              ? "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300"
              : "bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300"
          }
        >
          {row.original.isDayType ? "Day Type" : "Non-Day Type"}
        </Badge>
      ),
    },
    {
      accessorKey: "slotsPerMonth",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Slots/Month" />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => <ActionsCell row={row} onPricing={onPricing} />,
    },
  ];
}
