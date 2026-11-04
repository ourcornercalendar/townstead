"use client";

import { useMemo } from "react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { buildPrintMonth, type PrintedEvent } from "@/lib/events/print-month";
import {
  bySlot,
  clampPriority,
  fitToSquare,
  inPrintOrder,
} from "@/lib/events/print-priority";
import { cn } from "@/lib/utils";

/**
 * One square of the printed calendar, as it will look, while you type.
 *
 * Joyce and whoever is helping were writing an event, saving it, downloading
 * a PDF, looking, and coming back. For the question "will this fit, and
 * where will it sit against what is already on that day" that is a long way
 * round.
 *
 * WHAT MAKES IT HONEST
 *
 * 1. It is built by `buildPrintMonth` and `bySlot` — the same two functions
 *    that build the PDF. Not a second implementation that agrees most of the
 *    time. The draft being typed is folded in as a real event and goes
 *    through the same expansion, ordering and slotting as everything else.
 *
 * 2. It is drawn at the printed square's own proportions. A square measures
 *    113pt across on the page and about the same down at its tightest, and
 *    the type in it is 8pt and 7.5pt. Everything below is those numbers
 *    multiplied by one scale factor, so the amount of text that fits here is
 *    the amount that fits on paper.
 *
 * WHERE IT IS STILL AN APPROXIMATION, and the caller says so on screen:
 * a browser is not a PDF renderer, so a line may wrap a word earlier or
 * later than the printed page does. And a week row on paper STRETCHES to fit
 * its busiest day, so a square is often taller than this. This shows the
 * tightest case, which is the one worth seeing.
 */

/** Measured off a rendered page: 792pt wide, seven columns. */
const CELL_WIDTH_PT = 113.17;
/**
 * A square is exactly this tall — the page divided evenly between five
 * rows. Fixed, not a minimum: the rows do not stretch to fit their content,
 * because this is a grid that gets printed on paper and has to line up.
 *
 * Which is what makes this preview honest. There is no "the real one may be
 * taller" caveat any more: what fits here is what fits.
 */
const CELL_HEIGHT_PT = 112.9;

/** Drawn at this many pixels per point. */
const SCALE = 2.47;

const pt = (value: number) => `${(value * SCALE).toFixed(1)}px`;

/** The draft being typed. Only the parts that show on paper. */
export type SquareDraft = {
  name: string;
  description?: string;
  date: number;
  priority: number;
  scusd: boolean;
};

export function SquarePreview({
  draft,
  otherEvents,
  editingId,
  className,
}: {
  draft: SquareDraft;
  /** Everything already on this organisation's calendar. */
  otherEvents: Doc<"events">[];
  /** The event being edited, so it is not counted twice. */
  editingId?: Id<"events"> | null;
  className?: string;
}) {
  const valid = Number.isFinite(draft.date);

  const { events, hidden, linesEach, droppedDescriptions, dayOfMonth } =
    useMemo(() => {
    // The Date is built INSIDE the memo. Built outside, it is a new object
    // every render, so the memo never hits — and this recomputes a whole
    // month's layout on every keystroke of the name field.
    if (!valid) {
      return {
        events: [] as PrintedEvent[],
        hidden: 0,
        linesEach: 0,
        droppedDescriptions: false,
        dayOfMonth: 0,
      };
    }
    const day = new Date(draft.date);

    // The draft, shaped as a real event so the shared layout code treats it
    // exactly like the rest. A single-day entry: a repeating draft shows on
    // the date being edited, which is the square the person is looking at.
    const asEvent = {
      _id: "__draft__" as Id<"events">,
      _creationTime: Number.MAX_SAFE_INTEGER,
      orgId: "preview",
      name: draft.name.trim() || "Untitled event",
      description: draft.description?.trim() || undefined,
      date: draft.date,
      startsOn: draft.date,
      scheduleType: "SINGLE_DAY" as const,
      isDeleted: false,
      isApproved: true,
      isScusd: draft.scusd,
      printPriority: clampPriority(draft.priority),
    } as unknown as Doc<"events">;

    // Where two events share a position, the one added first prints first —
    // so WHERE the draft goes in this list matters, not just that it is in
    // it.
    //
    // Editing: the draft takes the original's place in the list, so an
    // event written last year still prints above one written yesterday.
    // Appending it instead would show it below, and the square would be
    // wrong in exactly the case somebody is looking at it to get right.
    //
    // New: last, which is where it will be once it is saved.
    const existing = editingId
      ? otherEvents.findIndex((e) => e._id === editingId)
      : -1;
    const withDraft =
      existing >= 0
        ? otherEvents.map((e, i) => (i === existing ? asEvent : e))
        : [...otherEvents, asEvent];

    const { cells } = buildPrintMonth(
      day.getFullYear(),
      day.getMonth(),
      withDraft
    );
    const cell = cells.find((c) => c.day === day.getDate());
    const all = inPrintOrder(cell?.events ?? []);
    // The same fitting the printed page does: the square cannot grow, so a
    // busy day loses its descriptions and then its last events.
    const { shown, hidden, linesEach } = fitToSquare(all);
    return {
      events: shown,
      hidden,
      linesEach,
      // Descriptions start being dropped as soon as the allowance falls to
      // one line, which is worth saying before somebody wonders where
      // their text went.
      droppedDescriptions:
        linesEach === 1 && all.some((e) => Boolean(e.description)),
      dayOfMonth: day.getDate(),
    };
  }, [draft, otherEvents, editingId, valid]);

  if (!valid) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Pick a date to see the square.
      </p>
    );
  }

  const slots = bySlot(events);

  return (
    <div className={className} data-testid="square-preview">
      {/* Structure in INLINE styles, not utility classes. This is a
          facsimile of a printed page: it has to lay out the same whatever
          the surrounding theme does, and it has to be right in a plain
          screenshot harness as well as in the app. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          border: "1px solid #a3a3a3",
          width: pt(CELL_WIDTH_PT),
          height: pt(CELL_HEIGHT_PT),
          padding: pt(4),
          // Inline, not a utility class: this square is a facsimile of a
          // printed page and must look the same whatever the surrounding
          // theme does, light or dark.
          backgroundColor: "#ffffff",
          position: "relative",
          // Helvetica is what the PDF sets. Matching it here is what makes
          // the wrapping roughly agree.
          fontFamily: "Helvetica, Arial, sans-serif",
          color: "#1a1a1a",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: pt(3),
            right: pt(5),
            fontSize: pt(11),
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {dayOfMonth}
        </span>

        <div
          style={{ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0 }}
        >
          {slots.map((inSlot, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                flexBasis: "auto",
                justifyContent:
                  index === 0
                    ? "flex-start"
                    : index === slots.length - 1
                      ? "flex-end"
                      : "center",
                paddingTop: index === 0 ? pt(13) : undefined,
              }}
            >
              {inSlot.map((event) => (
                <div
                  key={event.id}
                  data-testid={
                    event.id === "__draft__" ? "preview-draft" : "preview-other"
                  }
                  style={{
                    marginBottom: pt(1.5),
                    color: event.scusd ? "#c0140f" : undefined,
                    // The draft is the thing being worked on; the rest is
                    // context. Shown at full strength but outlined, rather
                    // than faded — fading it would misrepresent how it
                    // prints.
                    outline:
                      event.id === "__draft__"
                        ? "1.5px solid #14b8a6"
                        : undefined,
                    outlineOffset: "1px",
                  }}
                >
                  {/* Name and description in ONE clamped block, exactly as
                      the PDF nests them — and clamped to the same line
                      allowance, so the preview cuts the text off where the
                      printed square does. Without the clamp the preview
                      would cheerfully show four lines of description that
                      will never reach the paper. */}
                  <div
                    style={{
                      fontSize: pt(8),
                      fontWeight: 700,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: linesEach,
                      overflow: "hidden",
                      // So the "\n" between name and description breaks the
                      // line, as the nested Text does in the PDF.
                      whiteSpace: "pre-line",
                    }}
                  >
                    {event.name}
                    {event.description ? (
                      <>
                        {"\n"}
                        <span
                          style={{ fontSize: pt(7.5), fontWeight: 400 }}
                        >
                          {event.description}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 max-w-[280px] text-xs text-muted-foreground">
        {events.length + hidden === 1
          ? "Nothing else is on this day."
          : `${events.length + hidden - 1} other event${
              events.length + hidden === 2 ? "" : "s"
            } on this day.`}{" "}
        The square is a fixed size on paper, so this is the real amount of
        room. A word may wrap a little differently when it prints.
      </p>

      {droppedDescriptions && (
        <p
          data-testid="square-preview-trimmed"
          className="mt-1 max-w-[280px] text-xs text-amber-700 dark:text-amber-400"
        >
          This day is busy enough that only the names print — the
          descriptions are left off to make them all fit.
        </p>
      )}

      {hidden > 0 && (
        <p
          data-testid="square-preview-full"
          className="mt-1 max-w-[280px] text-xs text-amber-700 dark:text-amber-400"
        >
          {hidden} event{hidden === 1 ? "" : "s"} will not fit on this day and
          {hidden === 1 ? " is" : " are"} not printed. The calendar shows
          &ldquo;+{hidden} more&rdquo; instead.
        </p>
      )}
    </div>
  );
}
