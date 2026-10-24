"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Categories, on the helper's own page.
 *
 * A helper is never a Clerk organisation member, so `/admin` refuses them
 * outright — every admin screen does. Without this panel the owner could
 * switch "add categories" on and the person would have nowhere at all to do
 * it: a permission granting a power with no way to exercise it.
 *
 * Event categories only. A helper is here to work on the calendar, and the
 * same table also holds blog, video and business categories that have
 * nothing to do with them.
 */
export function CategoriesPanel({
  orgId,
  canAdd,
  canEdit,
  canDelete,
}: {
  orgId: string;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const categories = useQuery(api.categories.queries.list, {
    orgId,
    type: "event" as const,
  });
  const create = useMutation(api.categories.mutations.create);
  const update = useMutation(api.categories.mutations.update);
  const softDelete = useMutation(api.categories.mutations.softDelete);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Nothing switched on: show nothing at all rather than an empty panel that
  // invites them to press buttons that are not there.
  if (!canAdd && !canEdit && !canDelete) return null;

  const onAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await create({ orgId, name, type: "event" });
      setNewName("");
      toast.success("Category added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that");
    } finally {
      setBusy(false);
    }
  };

  const onRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await update({ id: id as Id<"categories">, name });
      setEditingId(null);
      toast.success("Renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename that");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await softDelete({ id: deleting.id as Id<"categories"> });
      setDeleting(null);
      toast.success("Category deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border" data-testid="categories-panel">
      <div className="flex items-center gap-2 border-b p-4">
        <Tag className="size-4 text-teal-500" />
        <h2 className="text-sm font-semibold">Event categories</h2>
        <span className="text-xs text-muted-foreground">
          How events are grouped on the website.
        </span>
      </div>

      <div className="space-y-2 p-4">
        {categories === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet{canAdd ? " — add the first one below." : "."}
          </p>
        ) : (
          categories.map((c) => (
            <div
              key={c._id}
              className="flex items-center justify-between gap-3 rounded-md border p-2.5"
            >
              {editingId === c._id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onRename(c._id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8"
                    aria-label={`Rename ${c.name}`}
                    autoFocus
                  />
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" disabled={busy} onClick={() => onRename(c._id)}>
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="truncate text-sm">{c.name}</span>
                  <div className="flex shrink-0 gap-1">
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Rename ${c.name}`}
                        onClick={() => {
                          setEditingId(c._id);
                          setEditingName(c.name);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => setDeleting({ id: c._id, name: c.name })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}

        {canAdd && (
          <div className="flex gap-2 pt-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              placeholder="New category, e.g. School District"
              aria-label="New category name"
              className="h-9"
            />
            <Button onClick={onAdd} disabled={busy || !newName.trim()} size="sm">
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.name}&rdquo; will stop being offered. Events
              filed under it keep everything else and simply stop showing a
              category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={busy}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
