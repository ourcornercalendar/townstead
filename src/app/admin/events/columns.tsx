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
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { formatEventSchedule, getEffectiveScheduleType } from "@/lib/events/recurrence";

type Event = Doc<"events">;

function ActionsCell({
  row,
  onEdit,
}: {
  row: { original: Event };
  onEdit: (event: Event) => void;
}) {
  const softDelete = useMutation(api.events.mutations.softDelete);
  const approveEvent = useMutation(api.events.mutations.approve);
  const rejectEvent = useMutation(api.events.mutations.reject);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPending = row.original.isApproved === false;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await softDelete({ id: row.original._id });
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const handleApprove = async () => {
    try {
      await approveEvent({ id: row.original._id });
      toast.success("Event approved");
    } catch {
      toast.error("Failed to approve event");
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await rejectEvent({ id: row.original._id });
      toast.success("Event rejected");
    } catch {
      toast.error("Failed to reject event");
    } finally {
      setLoading(false);
      setRejectOpen(false);
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
          {isPending && (
            <>
              <DropdownMenuItem onClick={handleApprove}>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRejectOpen(true)}
                className="text-destructive"
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => onEdit(row.original)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
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
        title="Delete Event"
        description={`Are you sure you want to delete "${row.original.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
        loading={loading}
      />
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject Event"
        description={`Are you sure you want to reject "${row.original.name}"? This will remove the submission.`}
        onConfirm={handleReject}
        confirmLabel="Reject"
        variant="destructive"
        loading={loading}
      />
    </>
  );
}

export function columns({
  onEdit,
  calendarEditions,
  categories = [],
}: {
  onEdit: (event: Event) => void;
  calendarEditions: Doc<"calendarEditions">[];
  categories?: Doc<"categories">[];
}): ColumnDef<Event>[] {
  const editionMap = new Map(calendarEditions.map((c) => [c._id, c.name]));
  const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      // The owner's own filing scheme. "__none__" rather than "" so that
      // "No category" is a thing you can actively filter FOR — finding the
      // events that still need filing is most of the point of having this
      // column at all.
      id: "category",
      accessorFn: (row) =>
        (row.categoryId && categoryMap.get(row.categoryId)) || "__none__",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        const name =
          row.original.categoryId && categoryMap.get(row.original.categoryId);
        if (!name) {
          return (
            <span className="text-xs text-muted-foreground">No category</span>
          );
        }
        return (
          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-500/20 dark:text-purple-300">
            {name}
          </Badge>
        );
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      meta: {
        filterOptions: [
          ...categories.map((c) => ({ label: c.name, value: c.name })),
          { label: "No category", value: "__none__" },
        ],
      },
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) =>
        formatEventSchedule(row.original, new Date().getFullYear()) ||
        formatDate(row.original.date),
      sortingFn: "basic",
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const approved = row.original.isApproved;
        if (approved === false) {
          return (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300">
              Pending
            </Badge>
          );
        }
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-500/20 dark:text-green-300">
            Approved
          </Badge>
        );
      },
    },
    {
      id: "recurring",
      header: "Recurring",
      enableSorting: false,
      cell: ({ row }) => {
        const scheduleType = getEffectiveScheduleType(row.original);
        if (scheduleType === "SINGLE_DAY" && !row.original.isYearly) return null;
        const label =
          scheduleType === "DAILY_RANGE"
            ? "Daily"
            : scheduleType === "MONTHLY_DAY"
              ? "Monthly Day"
              : scheduleType === "MONTHLY_ORDINAL_WEEKDAY"
                ? "Monthly Weekday"
                : "Yearly";
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300">
            {label}
          </Badge>
        );
      },
    },
    {
      id: "calendarEditions",
      header: "Calendar Editions",
      enableSorting: false,
      cell: ({ row }) => {
        const ids = row.original.calendarEditionIds;
        if (!ids || ids.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => (
              <Badge key={id} className="bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-500/20 dark:text-teal-300">
                {editionMap.get(id) ?? "Unknown"}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => <ActionsCell row={row} onEdit={onEdit} />,
    },
  ];
}
