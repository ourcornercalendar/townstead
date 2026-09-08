/**
 * Filing advertisers the way a person would.
 *
 * Every list in this app that Joyce reads by name -- purchases, contacts,
 * payments, this month's billing -- should be in the same order, and that
 * order should match what she would do with a box of index cards.
 *
 * Two things a plain `a < b` comparison gets wrong, and both had made it into
 * the app:
 *
 *   - It compares character codes, so every capital letter sorts before every
 *     small one. "apex Signs" lands after "Zeppole Bakery", at the bottom of
 *     the list, which reads as no sort at all.
 *   - It puts accented letters after Z. "Élan Salon" would be filed past the
 *     end of the alphabet rather than under E.
 *
 * `localeCompare` with a base sensitivity handles both, and `numeric` keeps
 * "5 Star Roofing" and "10 Star Roofing" in counting order rather than
 * character order.
 */

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

/**
 * The name a row is filed under: the business if it has one, otherwise the
 * person. A row must be sorted by the name it actually shows -- a list sorted
 * by a name that is not on screen looks, to the person reading it, exactly
 * like a list that was never sorted.
 */
export function displayName(row: {
  company?: string | null;
  contactName?: string | null;
}): string {
  return (row.company || row.contactName || "").trim();
}

/** Compare two rows by the name they display. */
export function byDisplayName(
  a: { company?: string | null; contactName?: string | null },
  b: { company?: string | null; contactName?: string | null }
): number {
  return collator.compare(displayName(a), displayName(b));
}

/** Compare two names directly. */
export function byName(a: string | null | undefined, b: string | null | undefined): number {
  return collator.compare((a || "").trim(), (b || "").trim());
}
