import { describe, it, expect } from "vitest";
import { sortAdvertisements, PREFERRED_ORDER } from "./order";

/**
 * The running order of the advertisement list.
 *
 * Joyce gave a specific order for the non-day placements. The point of these
 * is not that the list is correct -- it is that the list is only a starting
 * position, and stops governing the moment she rearranges anything.
 */

function ad(name: string, isDayType = false, displayOrder?: number) {
  return { name, isDayType, displayOrder };
}

describe("before anyone has rearranged anything", () => {
  it("uses Joyce's order for the placements she named", () => {
    const shuffled = [
      ad("Coupons"),
      ad("Billboard"),
      ad("Junior Coupons"),
      ad("Display"),
      ad("Monthly Photo"),
      ad("Date Blocks"),
      ad("Premium Display"),
    ];
    expect(sortAdvertisements(shuffled).map((a) => a.name)).toEqual([
      "Billboard",
      "Premium Display",
      "Monthly Photo",
      "Display",
      "Date Blocks",
      "Coupons",
      "Junior Coupons",
    ]);
  });

  it("is not simply alphabetical", () => {
    // Guards against someone 'simplifying' this to a .sort() later: the
    // alphabetical order of these seven is a different order entirely.
    const names = sortAdvertisements([
      ad("Coupons"),
      ad("Billboard"),
      ad("Display"),
    ]).map((a) => a.name);
    expect(names).toEqual(["Billboard", "Display", "Coupons"]);
    expect(names).not.toEqual([...names].sort());
  });

  it("does not care about capitals or extra spaces", () => {
    const names = sortAdvertisements([
      ad("coupons"),
      ad("  BILLBOARD  "),
      ad("Premium   Display"),
    ]).map((a) => a.name.trim());
    expect(names).toEqual(["BILLBOARD", "Premium   Display", "coupons"]);
  });

  it("keeps an unrecognised placement, after the named ones", () => {
    // The failure worth avoiding: a new advertisement quietly disappearing
    // because nobody added it to a list in the code.
    const names = sortAdvertisements([
      ad("Zebra Sponsorship"),
      ad("Billboard"),
      ad("Anniversary Banner"),
    ]).map((a) => a.name);
    expect(names).toEqual([
      "Billboard",
      "Anniversary Banner",
      "Zebra Sponsorship",
    ]);
  });

  it("puts day types after the non-day placements", () => {
    const names = sortAdvertisements([
      ad("Day Square", true),
      ad("Coupons"),
      ad("Another Day", true),
    ]).map((a) => a.name);
    expect(names).toEqual(["Coupons", "Another Day", "Day Square"]);
  });
});

describe("once Joyce has rearranged them", () => {
  it("her order wins over the built-in one", () => {
    const names = sortAdvertisements([
      ad("Billboard", false, 2),
      ad("Coupons", false, 0),
      ad("Display", false, 1),
    ]).map((a) => a.name);
    expect(names).toEqual(["Coupons", "Display", "Billboard"]);
  });

  it("an arranged row sits above one never arranged", () => {
    const names = sortAdvertisements([
      ad("Billboard"),
      ad("Junior Coupons", false, 0),
    ]).map((a) => a.name);
    expect(names).toEqual(["Junior Coupons", "Billboard"]);
  });

  it("survives a rename, which a hardcoded list alone would not", () => {
    // "Coupons" renamed to "Coupon" is unrecognised by the built-in list, but
    // it has a stored position, so it stays exactly where she put it.
    const names = sortAdvertisements([
      ad("Billboard", false, 1),
      ad("Coupon", false, 0),
    ]).map((a) => a.name);
    expect(names).toEqual(["Coupon", "Billboard"]);
  });
});

describe("the list itself", () => {
  it("is the seven Joyce asked for, in her order", () => {
    expect(PREFERRED_ORDER).toEqual([
      "billboard",
      "premium display",
      "monthly photo",
      "display",
      "date blocks",
      "coupons",
      "junior coupons",
    ]);
  });

  it("does not mutate what it is given", () => {
    const input = [ad("Coupons"), ad("Billboard")];
    sortAdvertisements(input);
    expect(input.map((a) => a.name)).toEqual(["Coupons", "Billboard"]);
  });
});
