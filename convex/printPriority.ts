/**
 * Where an event sits inside its square on the printed calendar.
 *
 * WHAT CHANGED. This used to be three named bands — TOP, MIDDLE, BOTTOM —
 * which meant a day could hold three ranked events and no more. Joyce asked
 * for numbered positions instead: 1 prints at the top, 2 under it, and so on
 * down to the floor of the square.
 *
 * IT IS A NUMBER, NOT A LIST OF FIVE. Five is what a square comfortably holds
 * and what the buttons offer, but a busy day can go past it: set something to
 * 7 and that square simply divides into seven slots. A fixed list would have
 * meant telling her "no" on exactly the days that need the most arranging.
 *
 * THE POSITIONS ARE PINNED, not merely ordered. Joyce chose this deliberately:
 * position 5 means the bottom of the square, and an event at 5 stays at the
 * bottom even when nothing is above it. That is how the three bands behaved
 * and it is what makes a printed month look like a grid rather than a list.
 *
 * The old values still read correctly, so nothing has to be migrated before
 * this ships and the next calendar prints exactly as the last one did:
 *
 *     TOP → 1        (the top of the square)
 *     MIDDLE → 3     (the middle of five slots)
 *     BOTTOM → 5     (the floor)
 *
 * Five evenly-spaced slots put 1, 3 and 5 in the same places the three bands
 * put TOP, MIDDLE and BOTTOM. The change is invisible on paper until somebody
 * uses it.
 */

/** The smallest position. Below this is not a position. */
export const MIN_PRIORITY = 1;

/**
 * How many slots a square is divided into before anyone asks for more.
 *
 * Five because that is what Joyce asked for and about what an inch of paper
 * holds. A day whose highest position is larger gets that many instead.
 */
export const BASE_SLOTS = 5;

/**
 * A ceiling, so a typo cannot slice a square into four hundred invisible
 * strips. High enough that nobody filing real events will meet it.
 */
export const MAX_PRIORITY = 20;

/** The positions offered as buttons. Anything beyond is typed in. */
export const QUICK_PRIORITIES = [1, 2, 3, 4, 5] as const;

/** What the old three-band values mean as numbers. */
const LEGACY: Record<string, number> = { TOP: 1, MIDDLE: 3, BOTTOM: 5 };

/**
 * The default for an event that has never been given one.
 *
 * 1, not 3, and that matters: an event with no placement already printed at
 * the top, because TOP was what the form filled in and what the printed grid
 * assumed. Defaulting to the middle would have quietly rearranged every
 * event in the calendar the day this shipped.
 */
export const DEFAULT_PRIORITY = 1;

/** A number that is actually usable as a position, or null. */
export function cleanPriority(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < MIN_PRIORITY || rounded > MAX_PRIORITY) return null;
  return rounded;
}

/** Force a number into range, for a field someone is typing into. */
export function clampPriority(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_PRIORITY;
  return Math.min(MAX_PRIORITY, Math.max(MIN_PRIORITY, Math.round(n)));
}

/**
 * The position of one event: its own number, else its old band, else the top.
 */
export function priorityOf(event: {
  printPriority?: number | null;
  printPlacement?: string | null;
}): number {
  const own = cleanPriority(event?.printPriority);
  if (own !== null) return own;
  const legacy = event?.printPlacement;
  if (typeof legacy === "string" && legacy in LEGACY) return LEGACY[legacy];
  return DEFAULT_PRIORITY;
}

/**
 * How many slots one square is divided into.
 *
 * Five normally; more when something on that day asks for more. Worked out
 * per day rather than for the whole month, so one crowded Saturday does not
 * shrink the type on every other square of the page.
 */
export function slotsForDay(priorities: readonly number[]): number {
  let highest = BASE_SLOTS;
  for (const p of priorities) if (p > highest) highest = p;
  return Math.min(MAX_PRIORITY, highest);
}

/**
 * Events in printing order: by position, and within a position in the order
 * they were added — which is what two events sharing a number did before and
 * still do.
 *
 * A stable sort, so "the order they were added" is a promise and not an
 * accident of the sort algorithm. Array.prototype.sort is specified stable in
 * modern JavaScript, but the index tiebreak says so out loud and survives
 * anyone reaching for a different sort later.
 */
export function inPrintOrder<T extends { priority: number }>(
  events: readonly T[]
): T[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.priority !== b.event.priority
        ? a.event.priority - b.event.priority
        : a.index - b.index
    )
    .map((x) => x.event);
}

/**
 * The events of one day grouped into their slots, slot 1 first.
 *
 * Every slot is returned, empty ones included. That is the whole point of
 * pinning: the empty slots are what hold an event at position 5 down at the
 * floor instead of letting it float up under the one above.
 */
export function bySlot<T extends { priority: number }>(
  events: readonly T[]
): T[][] {
  const slots = slotsForDay(events.map((e) => e.priority));
  const out: T[][] = Array.from({ length: slots }, () => []);
  for (const event of inPrintOrder(events)) {
    // Anything past the last slot joins it rather than disappearing. Nothing
    // is ever dropped off the printed calendar.
    const index = Math.min(slots, Math.max(MIN_PRIORITY, event.priority)) - 1;
    out[index].push(event);
  }
  return out;
}
