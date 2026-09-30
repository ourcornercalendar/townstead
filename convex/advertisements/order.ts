/**
 * The running order of advertisement types.
 *
 * Joyce arranges these by hand, and her choice is stored on each record as
 * `displayOrder`. But every advertisement that existed before that field did
 * has no value in it, and an empty list sorted by insertion order is not an
 * order anybody chose.
 *
 * So there are two layers:
 *
 * 1. `displayOrder`, when set. Whatever Joyce last dragged into place wins.
 * 2. Failing that, the order below — the one she asked for — and then
 *    anything unrecognised, alphabetically.
 *
 * The list is a starting position, not the rule. The moment she moves a row,
 * every row gets a real `displayOrder` and this list stops mattering. That
 * matters because a hardcoded list quietly misbehaves as soon as somebody
 * renames "Coupons" to "Coupon": with the list as the only mechanism, that
 * advertisement would drop to the bottom for no visible reason.
 */

/** Joyce's order for the non-day placements, September 2026. */
export const PREFERRED_ORDER = [
  "billboard",
  "premium display",
  "monthly photo",
  "display",
  "date blocks",
  "coupons",
  "junior coupons",
] as const;

/** Loose match: case and surrounding space should not decide the order. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function preferredIndex(name: string): number {
  const i = PREFERRED_ORDER.indexOf(
    normalize(name) as (typeof PREFERRED_ORDER)[number]
  );
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export interface Orderable {
  name: string;
  isDayType: boolean;
  displayOrder?: number;
}

/**
 * Sorts advertisements into the order they should be shown in.
 *
 * Records carrying a `displayOrder` come first, in that order. The rest fall
 * back to: non-day before day-type, then Joyce's list, then alphabetical.
 * Nothing is ever dropped -- an advertisement nobody has named in the list
 * still appears, just after the ones that are.
 */
export function sortAdvertisements<T extends Orderable>(ads: T[]): T[] {
  return [...ads].sort((a, b) => {
    const ao = a.displayOrder;
    const bo = b.displayOrder;

    if (ao !== undefined && bo !== undefined) return ao - bo;
    // An arranged row always sits above one that has never been arranged.
    if (ao !== undefined) return -1;
    if (bo !== undefined) return 1;

    // Neither has been arranged: the sensible default.
    if (a.isDayType !== b.isDayType) return a.isDayType ? 1 : -1;
    const ai = preferredIndex(a.name);
    const bi = preferredIndex(b.name);
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}
