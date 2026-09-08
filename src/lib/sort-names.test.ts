import { describe, it, expect } from "vitest";
import { byDisplayName, byName, displayName } from "./sort-names";

/**
 * Filing advertisers the way a person would.
 *
 * Every list Joyce reads by name should be in the same order, and that order
 * should match what she would do with a box of index cards. The cases below
 * are the ones a plain string comparison gets wrong -- and two of them were
 * live in the app.
 */

const sorted = (names: string[]) => [...names].sort(byName);

describe("filing names", () => {
  it("puts them in alphabetical order", () => {
    expect(sorted(["Zeppole Bakery", "Anderson Plumbing", "Miller Dental"])).toEqual([
      "Anderson Plumbing",
      "Miller Dental",
      "Zeppole Bakery",
    ]);
  });

  it("does not exile lower-case names to the bottom", () => {
    // A plain comparison files every capital before every small letter, so
    // "apex Signs" would land after "Zeppole Bakery" and the list would read
    // as though it had never been sorted.
    expect(sorted(["Zeppole Bakery", "apex Signs", "Miller Dental"])).toEqual([
      "apex Signs",
      "Miller Dental",
      "Zeppole Bakery",
    ]);
  });

  it("files accented names under their letter, not after Z", () => {
    expect(sorted(["Zeppole Bakery", "Élan Salon", "Foster Law"])).toEqual([
      "Élan Salon",
      "Foster Law",
      "Zeppole Bakery",
    ]);
  });

  it("counts numbers rather than comparing their characters", () => {
    // Character order would put 10 before 5, because "1" is before "5".
    expect(sorted(["10 Star Roofing", "5 Star Roofing", "2 Brothers Pizza"])).toEqual([
      "2 Brothers Pizza",
      "5 Star Roofing",
      "10 Star Roofing",
    ]);
  });

  it("ignores stray spaces around a name", () => {
    expect(sorted(["  Miller Dental", "Anderson Plumbing"])).toEqual([
      "Anderson Plumbing",
      "  Miller Dental",
    ]);
  });

  it("does not fall over on a missing name", () => {
    expect(() => sorted(["Anderson Plumbing", undefined as unknown as string])).not.toThrow();
  });
});

describe("which name a row is filed under", () => {
  it("uses the business when there is one", () => {
    expect(displayName({ company: "Zeppole Bakery", contactName: "Ada Byron" })).toBe(
      "Zeppole Bakery"
    );
  });

  it("falls back to the person when there is no business", () => {
    expect(displayName({ company: "", contactName: "Ada Byron" })).toBe("Ada Byron");
  });

  it("sorts by the name that is actually shown", () => {
    // The bug this was written for: the billing payments list sorted by the
    // person's name while the column displayed the company. Every row was in
    // order by a name nobody could see, which looks exactly like no order.
    const rows = [
      { company: "Zeppole Bakery", contactName: "Ada Byron" },
      { company: "Anderson Plumbing", contactName: "Zoe Wren" },
    ];
    const order = [...rows].sort(byDisplayName).map(displayName);
    expect(order).toEqual(["Anderson Plumbing", "Zeppole Bakery"]);
  });

  it("mixes businesses and people into one alphabet", () => {
    const rows = [
      { company: "Zeppole Bakery", contactName: "Ada Byron" },
      { company: "", contactName: "Brenda Callas" },
      { company: "Anderson Plumbing", contactName: "Zoe Wren" },
    ];
    expect([...rows].sort(byDisplayName).map(displayName)).toEqual([
      "Anderson Plumbing",
      "Brenda Callas",
      "Zeppole Bakery",
    ]);
  });

  it("keeps a nameless row from breaking the sort", () => {
    const rows = [
      { company: "Zeppole Bakery", contactName: "Ada Byron" },
      { company: null, contactName: null },
    ];
    expect(() => [...rows].sort(byDisplayName)).not.toThrow();
  });
});
