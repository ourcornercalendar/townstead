/**
 * Searching and filtering the events desk.
 *
 * Kept out of the page component so it can be tested directly. The page is a
 * Clerk-and-Convex client component; standing one up in a test to find out
 * whether "csd" matches an event filed under CSD would test the mocking far
 * more than the matching.
 */

/**
 * Sentinels for the category filter. An empty string cannot be a Select
 * value in this library -- it is how the component says "nothing picked" --
 * so both of these have to be something no Convex id could ever be.
 */
export const ALL_CATEGORIES = "__all__";
export const NO_CATEGORY = "__none__";

export interface SearchableEvent {
  name: string;
  description?: string;
  location?: string;
  categoryId?: string;
}

/**
 * What the category dropdown's button should read.
 *
 * This is Base UI, not Radix: its Select.Value renders the VALUE, so a
 * dropdown left to its own devices shows the raw Convex id -- "k57b2x9..."
 * where the category name belongs. That bug reached the live site once
 * already, on the event form.
 */
export function categoryFilterLabel(
  categoryNames: ReadonlyMap<string, string>,
  value: string
): string {
  if (value === ALL_CATEGORIES) return "All categories";
  if (value === NO_CATEGORY) return "No category";
  // An id with no matching category -- deleted while the filter was open --
  // must still never print the id.
  return categoryNames.get(value) ?? "All categories";
}

/**
 * The events to show, given what is typed in the box and picked in the
 * dropdown. The two narrow together: a search inside a chosen category
 * searches only that category.
 */
export function filterEvents<T extends SearchableEvent>(
  events: readonly T[],
  options: {
    search: string;
    categoryFilter: string;
    categoryNames: ReadonlyMap<string, string>;
  }
): T[] {
  const term = options.search.trim().toLowerCase();

  return events.filter((event) => {
    if (
      options.categoryFilter !== ALL_CATEGORIES &&
      (event.categoryId ?? NO_CATEGORY) !== options.categoryFilter
    ) {
      return false;
    }
    if (!term) return true;

    // Name, place, description and what it is filed under. An event is as
    // likely to be remembered by its category as by its name, and this
    // matches the owner's own events screen, which searches all four.
    return [
      event.name,
      event.description,
      event.location,
      event.categoryId ? options.categoryNames.get(event.categoryId) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}
