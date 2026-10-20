"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AD_STATUSES,
  AD_STATUS_LABELS,
  type AdStatus,
} from "../../../convex/contacts/adStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Where a business's advertisement has got to.
 *
 * One component in two forms -- a badge to read and a dropdown to change --
 * so that the same six words and the same six colours appear on every screen
 * Joyce sees a business on. Two lists that colour the same stage differently
 * are worse than one list that doesn't show it at all.
 *
 * The colours run cool to warm to green: waiting on us, waiting on someone
 * else, needs attention, done. `changes` is the one that should catch the eye,
 * because it is the only stage where somebody has to do something before
 * anything else can happen.
 */

const STATUS_CLASSES: Record<AdStatus, string> = {
  requested:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  sent_to_mark:
    "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  sent_to_client:
    "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  changes:
    "bg-amber-100 text-amber-900 dark:bg-amber-500/25 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  placed:
    "bg-teal-800 text-white dark:bg-teal-600 dark:text-white",
};

const NOT_SET_CLASS =
  "bg-transparent text-muted-foreground/70 border border-dashed border-muted-foreground/30";

export function adStatusLabel(status: AdStatus | undefined | null): string {
  return status ? AD_STATUS_LABELS[status] : "Not set";
}

/** Read-only. For lists and detail pages where changing it isn't the job. */
export function AdStatusBadge({
  status,
  className,
}: {
  status?: AdStatus | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        status ? STATUS_CLASSES[status] : NOT_SET_CLASS,
        className
      )}
    >
      {adStatusLabel(status)}
    </span>
  );
}

/**
 * The dropdown. Saves on change -- there is no separate save button, because
 * a list of forty businesses with forty save buttons is a list nobody keeps
 * up to date.
 */
export function AdStatusSelect({
  contactId,
  status,
  className,
}: {
  contactId: Id<"contacts">;
  status?: AdStatus | null;
  className?: string;
}) {
  const setAdStatus = useMutation(api.contacts.mutations.setAdStatus);
  const [saving, setSaving] = useState(false);

  const onChange = async (value: string | null) => {
    if (!value) return;
    const next = value === "__none" ? null : (value as AdStatus);
    setSaving(true);
    try {
      await setAdStatus({ id: contactId, adStatus: next });
    } catch {
      toast.error("Couldn't save that status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      value={status ?? "__none"}
      onValueChange={onChange}
      disabled={saving}
    >
      <SelectTrigger
        className={cn("h-7 w-[150px] text-xs", className)}
        aria-label="Advertisement status"
        // Stops a click on the dropdown also opening whatever row it sits in.
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue>
          <AdStatusBadge status={status} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value="__none">
          <span className="text-muted-foreground">Not set</span>
        </SelectItem>
        {AD_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {AD_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
