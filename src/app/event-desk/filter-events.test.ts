import { describe, it, expect } from "vitest";
import {
  ALL_CATEGORIES,
  NO_CATEGORY,
  categoryFilterLabel,
  filterEvents,
  type SearchableEvent,
} from "./filter-events";

/**
 * Searching and filtering on the helper's own page.
 *
 * The owner asked that the people she invites be able to search events and
 * categories, not only the ones she searches herself on /admin. Her events
 * screen already matched a category name; this page matched only name and
 * place, so typing "CSD" on it found nothing even when events were filed
 * under CSD.
 */

const CSD = "cat_csd";
const SCHOOL = "cat_school";

const names = new Map<string, string>([
  [CSD, "CSD"],
  [SCHOOL, "School District"],
]);

const EVENTS: SearchableEvent[] = [
  { name: "Board Meeting", categoryId: CSD, location: "District Office" },
  { name: "Spring Concert", categoryId: SCHOOL, location: "High School Gym" },
  { name: "Farmers Market", location: "Main Street" },
  {
    name: "Clean-up Day",
    categoryId: CSD,
    description: "Bring gloves and a rake",
  },
];

function run(search: string, categoryFilter = ALL_CATEGORIES) {
  return filterEvents(EVENTS, {
    search,
    categoryFilter,
    categoryNames: names,
  }).map((e) => e.name);
}

describe("searching", () => {
  it("finds an event by its category name — the whole point of the change", () => {
    expect(run("CSD")).toEqual(["Board Meeting", "Clean-up Day"]);
  });

  it("does not care about case", () => {
    expect(run("csd")).toEqual(["Board Meeting", "Clean-up Day"]);
    expect(run("school district")).toEqual(["Spring Concert"]);
  });

  it("still finds an event by name", () => {
    expect(run("concert")).toEqual(["Spring Concert"]);
  });

  it("still finds an event by place", () => {
    expect(run("main street")).toEqual(["Farmers Market"]);
  });

  it("finds one by something only in the description", () => {
    expect(run("rake")).toEqual(["Clean-up Day"]);
  });

  it("an empty box shows everything, and so does a box of spaces", () => {
    expect(run("")).toHaveLength(4);
    expect(run("   ")).toHaveLength(4);
  });

  it("matches nothing rather than everything when nothing matches", () => {
    expect(run("xyzzy")).toEqual([]);
  });

  it("does not match an event on a category it is not filed under", () => {
    // The guard against building the haystack out of every category name
    // instead of this event's own.
    expect(run("School District")).not.toContain("Board Meeting");
  });
});

describe("the category dropdown", () => {
  it("shows only that category", () => {
    expect(run("", CSD)).toEqual(["Board Meeting", "Clean-up Day"]);
  });

  it("can single out the events filed under nothing", () => {
    expect(run("", NO_CATEGORY)).toEqual(["Farmers Market"]);
  });

  it("narrows together with the search box, not instead of it", () => {
    // Searching inside a chosen category searches only that category.
    expect(run("day", CSD)).toEqual(["Clean-up Day"]);
    expect(run("concert", CSD)).toEqual([]);
  });

  it("shows everything again when set back to all", () => {
    expect(run("", ALL_CATEGORIES)).toHaveLength(4);
  });
});

describe("what the dropdown button reads", () => {
  // Base UI renders the VALUE, not the item's text. This exact mistake put a
  // raw Convex id on screen on the event form once already.
  it("never shows a raw id", () => {
    expect(categoryFilterLabel(names, CSD)).toBe("CSD");
    expect(categoryFilterLabel(names, SCHOOL)).toBe("School District");
  });

  it("names the two sentinels in words", () => {
    expect(categoryFilterLabel(names, ALL_CATEGORIES)).toBe("All categories");
    expect(categoryFilterLabel(names, NO_CATEGORY)).toBe("No category");
  });

  it("falls back to words for a category deleted while the filter was open", () => {
    const label = categoryFilterLabel(names, "cat_gone");
    expect(label).toBe("All categories");
    expect(label).not.toContain("cat_");
  });
});
