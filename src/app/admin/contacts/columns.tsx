"use client";

import { type ColumnDef } from "@tanstack/react-table";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, MoreHorizontal, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { byDisplayName } from "@/lib/sort-names";
import { toast } from "sonner";

type Contact = Doc<"contacts">;

function ActionsCell({
  row,
  onEdit,
}: {
  row: { original: Contact };
  onEdit: (contact: Contact) => void;
}) {
  const router = useRouter();
  const softDelete = useMutation(api.contacts.mutations.softDelete);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await softDelete({ id: row.original._id });
      toast.success("Contact deleted");
    } catch {
      toast.error("Failed to delete contact");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const displayName = [row.original.firstName, row.original.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              router.push(`/admin/contacts/${row.original._id}`)
            }
          >
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(row.original)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/admin/purchases/new?contactId=${row.original._id}`)
            }
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add Purchase
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
        title="Delete Contact"
        description={`Are you sure you want to delete "${displayName}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
        loading={loading}
      />
    </>
  );
}

export function columns({
  onEdit,
}: {
  onEdit: (contact: Contact) => void;
}): ColumnDef<Contact>[] {
  return [
    {
      id: "company",
      accessorFn: (row) => {
        const contactName = [row.firstName, row.lastName]
          .filter(Boolean)
          .join(" ");
        return `${row.company || contactName} ${contactName}`;
      },
      // Filed under the business, or the person when there is no business --
      // the same rule the other lists use, so the two read the same way.
      sortingFn: (a, b) =>
        byDisplayName(
          {
            company: a.original.company,
            contactName: [a.original.firstName, a.original.lastName].filter(Boolean).join(" "),
          },
          {
            company: b.original.company,
            contactName: [b.original.firstName, b.original.lastName].filter(Boolean).join(" "),
          }
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Company" />
      ),
      cell: ({ row }) => {
        const contactName = [row.original.firstName, row.original.lastName]
          .filter(Boolean)
          .join(" ");
        const label =
          row.original.company ||
          contactName ||
          "—";
        const initial = label.charAt(0).toUpperCase();
        const colors = [
          "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
          "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
          "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
          "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
          "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
        ];
        const colorIdx = initial.charCodeAt(0) % colors.length;
        return (
          <Link
            href={`/admin/contacts/${row.original._id}`}
            className="flex items-center gap-2 hover:underline"
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colors[colorIdx]}`}>
              {initial}
            </span>
            <span>
              <span className="block font-medium text-primary">{label}</span>
              {row.original.company && contactName && (
                <span className="block text-xs text-muted-foreground">
                  {contactName}
                </span>
              )}
            </span>
          </Link>
        );
      },
    },
    {
      id: "name",
      accessorFn: (row) =>
        `${row.firstName} ${row.lastName}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      accessorKey: "phone",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Phone" />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => <ActionsCell row={row} onEdit={onEdit} />,
    },
  ];
}
