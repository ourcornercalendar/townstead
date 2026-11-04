"use client";

import { useMemo, useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { buildPrintMonth, type PrintedEvent } from "@/lib/events/print-month";
import {
  MAX_PRIORITY,
  MIN_PRIORITY,
  QUICK_PRIORITIES,
  bySlot,
  clampPriority,
  fitToSquare,
  inPrintOrder,
} from "@/lib/events/print-priority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The calendar as it will print, on screen.
 *
 * WHY IT EXISTS. The only way to see the effect of a change to the printed
 * calendar was to download the PDF, open it, look, go back, change
 * something, download it again. Whoever is arranging a busy month did that
 * dozens of times an afternoon.
 *
 * WHY IT IS TRUSTWORTHY. It calls `buildPrintMonth` and `bySlot` — the same
 * two functions the PDF calls. A preview that is a second implementation of
 * the layout agrees with the real thing right up until the day it matters,
 * and then it is worse than no preview at all, because it was believed.
 *
 * WHAT IT IS NOT. It is not a photograph of the PDF. The screen has more
 * room than an inch of newsprint, so type is bigger here and long
 * descriptions are not clipped the way paper clips them. What it is exact
 * about is the thing it is for: which events are on which day, and in what
 * position down the square.
 *
 * It is also where positions get CHANGED. Joyce has years of events that
 * have never been given one, and opening each event's form to set a number
 * would be a day's work. Clicking the event where she can see it is the
 * whole job.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPreview({
  events,
  canEdit,
  onSetPriority,
  initialYear,
  initialMonth,
}: {
  events: Doc<"events">[];
  /** False for someone who may look but not rearrange. */
  canEdit: boolean;
  onSetPriority?: (id: string, priority: number) => Promise<void>;
  initialYear?: number;
  initialMonth?: number;
}) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());

  const { cells, needsSplit } = useMemo(
    () => buildPrintMonth(year, month, events),
    [year, month, events]
  );

  const step = (by: number) => {
    const d = new Date(year, month + by, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const total = cells.reduce((n, c) => n + c.events.length, 0);

  return (
    <div className="rounded-lg border" data-testid="calendar-preview">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Previous month"
          onClick={() => step(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Next month"
          onClick={() => step(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold" data-testid="preview-month">
          {MONTHS[month]} {year}
        </h2>
        <span className="text-xs text-muted-foreground">
          {total === 0
            ? "Nothing on the calendar this month"
            : `${total} event${total === 1 ? "" : "s"}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8"
          onClick={() => {
            setYear(now.getFullYear());
            setMonth(now.getMonth());
          }}
        >
          This month
        </Button>
      </div>

      {needsSplit && (
        <p
          data-testid="preview-split-note"
          className="flex items-start gap-2 border-b bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <Info className="mt-px size-3.5 shrink-0" />
          This month needs six rows, so on paper the last two weeks share one
          row of squares and each day shows at most three events. Everything
          below is still on the calendar.
        </p>
      )}

      <div className="grid grid-cols-7 border-b text-center">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="border-r p-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <DaySquare
            key={i}
            day={cell.day}
            events={cell.events}
            canEdit={canEdit}
            onSetPriority={onSetPriority}
          />
        ))}
      </div>

      <p className="border-t p-3 text-xs text-muted-foreground">
        Each square holds five positions: 1 at the top, 5 at the bottom.
        {canEdit
          ? " Click an event to move it, or give a crowded day a 6th and 7th position."
          : " Positions are set by whoever runs the calendar."}
      </p>
    </div>
  );
}

function DaySquare({
  day,
  events,
  canEdit,
  onSetPriority,
}: {
  day: number | null;
  events: PrintedEvent[];
  canEdit: boolean;
  onSetPriority?: (id: string, priority: number) => Promise<void>;
}) {
  // The same fitting and slotting the printed square uses — empty slots and
  // all, which is what shows at a glance that position 5 really is sitting
  // at the floor. Fitting first matters: a printed square is a fixed size,
  // so a month view that listed events which never reach the paper would
  // be telling whoever is arranging it something untrue.
  const { shown, hidden } = fitToSquare(inPrintOrder(events));
  const slots = bySlot(shown);

  if (day === null) {
    return <div className="min-h-[104px] border-b border-r bg-muted/30 last:border-r-0" />;
  }

  return (
    <div className="flex min-h-[104px] flex-col border-b border-r p-1 last:border-r-0">
      <span className="px-0.5 text-[11px] font-semibold text-muted-foreground">
        {day}
      </span>
      <div className="flex flex-1 flex-col">
        {slots.map((inSlot, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-1 flex-col gap-0.5",
              index === 0 && "justify-start",
              index === slots.length - 1 && "justify-end",
              index > 0 && index < slots.length - 1 && "justify-center"
            )}
          >
            {inSlot.map((event) => (
              <PreviewEvent
                key={`${event.id}-${event.priority}`}
                event={event}
                canEdit={canEdit}
                onSetPriority={onSetPriority}
              />
            ))}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <span
          data-testid="day-overflow"
          className="px-0.5 text-[10px] italic text-muted-foreground"
        >
          +{hidden} more
        </span>
      )}
    </div>
  );
}

function PreviewEvent({
  event,
  canEdit,
  onSetPriority,
}: {
  event: PrintedEvent;
  canEdit: boolean;
  onSetPriority?: (id: string, priority: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState(String(event.priority));

  const label = (
    <>
      <span className="mr-1 inline-block min-w-[1.1em] rounded bg-muted px-1 text-center text-[9px] font-bold tabular-nums text-muted-foreground">
        {event.priority}
      </span>
      <span
        className={cn(
          "font-semibold",
          // School district dates print in red, so they are red here too.
          event.scusd && "text-red-700 dark:text-red-400",
          !event.isApproved && "italic opacity-70"
        )}
      >
        {event.name}
      </span>
    </>
  );

  if (!canEdit || !onSetPriority) {
    return (
      <div
        data-testid="preview-event"
        data-priority={event.priority}
        className="truncate px-0.5 text-[11px] leading-tight"
        title={event.name}
      >
        {label}
      </div>
    );
  }

  const move = async (to: number) => {
    const priority = clampPriority(to);
    if (priority === event.priority) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await onSetPriority(event.id, priority);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next)}>
      {/* Base UI, not Radix: the Trigger renders its own button and there is
          no asChild to wrap one in. */}
      <PopoverTrigger
        data-testid="preview-event"
        data-priority={event.priority}
        title={`${event.name} — position ${event.priority}`}
        className="w-full truncate rounded px-0.5 text-left text-[11px] leading-tight hover:bg-accent"
      >
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-60" align="start">
        <p className="truncate text-sm font-semibold" title={event.name}>
          {event.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Where it sits in this square.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {QUICK_PRIORITIES.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={event.priority === n ? "default" : "outline"}
              className="w-8"
              disabled={busy}
              aria-label={`Move to position ${n}`}
              aria-pressed={event.priority === n}
              onClick={() => move(n)}
            >
              {n}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min={MIN_PRIORITY}
            max={MAX_PRIORITY}
            value={typed}
            disabled={busy}
            aria-label="Another position"
            className="h-8 w-20"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") move(Number(typed));
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => move(Number(typed))}
          >
            Move
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A square holds five; a busy day can go further.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** Exported for the tests, which check the preview orders a day as paper does. */
export { inPrintOrder };
