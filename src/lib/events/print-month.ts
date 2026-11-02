import type { Doc } from "../../../convex/_generated/dataModel";
import { expandEventOccurrences } from "./recurrence";
import { priorityOf } from "./print-priority";

/**
 * One month of the calendar, laid out as the printed page lays it out.
 *
 * Shared by the PDF and by the preview on screen, and that sharing is the
 * whole point. A preview whose job is "see it without downloading the
 * calendar" is worth nothing if it is a second implementation that agrees
 * with the real one most of the time. Both call this.
 *
 * It does not know anything about paper or about React: it answers which
 * events fall on which day, in which position, and whether the month needs
 * six week-rows squeezed into five.
 */

export type PrintedEvent = {
  /** The event this came from. A recurring event yields one per occurrence. */
  id: string;
  name: string;
  description?: string;
  /** 1 at the top of the square, down to the floor. */
  priority: number;
  scusd: boolean;
  /** False for an occurrence of a repeating event after the first. */
  isApproved: boolean;
};

export type CalendarDayCell = {
  day: number | null;
  events: PrintedEvent[];
};

export type PrintMonth = {
  cells: CalendarDayCell[];
  /**
   * True when the month needs six week-rows. The printed page squeezes the
   * last two into one cell; the preview says so rather than pretending.
   */
  needsSplit: boolean;
};

export function buildPrintMonth(
  year: number,
  monthIndex: number,
  events: Doc<"events">[]
): PrintMonth {
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const byDay = new Map<number, PrintedEvent[]>();
  for (const event of events) {
    const occurrences = expandEventOccurrences(event, year);
    for (const occ of occurrences) {
      const d = new Date(occ.date);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const day = d.getDate();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push({
        id: String(event._id),
        name: event.name,
        description: event.description,
        priority: priorityOf(event),
        scusd: (event as { isScusd?: boolean }).isScusd === true,
        isApproved: (event as { isApproved?: boolean }).isApproved !== false,
      });
    }
  }

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, events: [] });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, events: byDay.get(day) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, events: [] });

  return { cells, needsSplit: cells.length > 35 };
}
