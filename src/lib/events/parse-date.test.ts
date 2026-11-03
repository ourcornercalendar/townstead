import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { parseTypedDate } from "./parse-date";

/**
 * What the date box shows when it is not being typed in. Kept identical to
 * the DatePicker's own default on purpose: these two have to agree, and the
 * round-trip test at the bottom is what proves they do.
 */
const DISPLAY = "MMM d, yyyy";
const shown = (ms: number) => format(new Date(ms), DISPLAY);

/**
 * Reading a date somebody typed.
 *
 * The failure that matters here is not "it refused something it should have
 * accepted" — that is visible and annoying. It is "it accepted something and
 * got it wrong", because a date wrong by a month goes silently onto a
 * printed calendar and out to people's letterboxes. Most of the blocks below
 * are about the second kind.
 */

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe("the forms people actually type", () => {
  it("slashes, American order", () => {
    expect(parseTypedDate("11/3/2026")).toBe(on(2026, 11, 3));
  });

  it("dashes and dots too", () => {
    expect(parseTypedDate("11-3-2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("11.3.2026")).toBe(on(2026, 11, 3));
  });

  it("a two-digit year", () => {
    expect(parseTypedDate("11/3/26")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("1/1/99")).toBe(on(2099, 1, 1));
  });

  it("ISO, which leads with the year", () => {
    expect(parseTypedDate("2026-11-03")).toBe(on(2026, 11, 3));
  });

  it("month names, long and short, with or without a comma", () => {
    expect(parseTypedDate("Nov 3 2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("November 3, 2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("nov 3 2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("Sept 3 2026")).toBe(on(2026, 9, 3));
  });

  it("day first, which is how half the world writes it out loud", () => {
    expect(parseTypedDate("3 Nov 2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("3 November 2026")).toBe(on(2026, 11, 3));
  });

  it("an ordinal suffix", () => {
    expect(parseTypedDate("Nov 3rd 2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("August 1st, 2027")).toBe(on(2027, 8, 1));
  });

  it("a weekday in front of it, pasted from somewhere", () => {
    expect(parseTypedDate("Tue, Nov 3 2026")).toBe(on(2026, 11, 3));
    expect(parseTypedDate("Tuesday November 3 2026")).toBe(on(2026, 11, 3));
  });

  it("extra spaces", () => {
    expect(parseTypedDate("  Nov   3   2026  ")).toBe(on(2026, 11, 3));
  });

  it("today, tomorrow, yesterday", () => {
    const now = new Date();
    const midnight = on(now.getFullYear(), now.getMonth() + 1, now.getDate());
    expect(parseTypedDate("today")).toBe(midnight);
    expect(parseTypedDate("tomorrow")).toBe(midnight + 86400000);
    expect(parseTypedDate("Yesterday")).toBe(midnight - 86400000);
  });
});

describe("no year typed", () => {
  it("uses the year being worked on, not necessarily this one", () => {
    // Typing "11/3" while arranging the 2027 calendar means 2027. Using the
    // system year would quietly file it a year early, every time, all year.
    expect(parseTypedDate("11/3", 2027)).toBe(on(2027, 11, 3));
    expect(parseTypedDate("Nov 3", 2027)).toBe(on(2027, 11, 3));
    expect(parseTypedDate("3 Nov", 2027)).toBe(on(2027, 11, 3));
  });
});

describe("what it refuses, rather than guessing at", () => {
  const refused = [
    "",
    "   ",
    "banana",
    "Novembr 3 2026",
    "November",
    "3",
    "//",
    "11/",
    "2026",
    "next tuesday",
    "the 3rd",
  ];
  for (const input of refused) {
    it(`refuses ${JSON.stringify(input)}`, () => {
      expect(parseTypedDate(input)).toBeNull();
    });
  }
});

describe("dates that do not exist", () => {
  // THE IMPORTANT BLOCK. JavaScript rolls 31 February forward into March
  // without a word of complaint, so a naive parser turns a typo into a real
  // date on the wrong day and nothing anywhere says so.
  it("refuses the 31st of February instead of making it the 3rd of March", () => {
    expect(parseTypedDate("2/31/2026")).toBeNull();
    expect(parseTypedDate("Feb 31 2026")).toBeNull();
  });

  it("refuses the 31st of a thirty-day month", () => {
    expect(parseTypedDate("4/31/2026")).toBeNull();
    expect(parseTypedDate("9/31/2026")).toBeNull();
  });

  it("refuses a month that is not a month", () => {
    expect(parseTypedDate("13/1/2026")).toBeNull();
    expect(parseTypedDate("0/1/2026")).toBeNull();
  });

  it("refuses a day of zero", () => {
    expect(parseTypedDate("11/0/2026")).toBeNull();
  });

  it("knows which Februaries have 29 days", () => {
    expect(parseTypedDate("2/29/2028")).toBe(on(2028, 2, 29));
    expect(parseTypedDate("2/29/2027")).toBeNull();
    // 2100 is not a leap year, whatever the every-four-years rule suggests.
    expect(parseTypedDate("2/29/2100")).toBeNull();
  });

  it("refuses a year from another era", () => {
    expect(parseTypedDate("11/3/1203")).toBeNull();
    expect(parseTypedDate("11/3/3000")).toBeNull();
  });
});

describe("the result is always local midnight", () => {
  // The rest of the application stores and compares local midnight. A date
  // an hour off lands on the wrong day in the wrong timezone, which is the
  // classic way an event appears on the 2nd for some readers and the 3rd
  // for others.
  it("has no time of day on it", () => {
    const d = new Date(parseTypedDate("11/3/2026")!);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("every spelling of one date gives the identical number", () => {
    const forms = [
      "11/3/2026",
      "11-3-2026",
      "2026-11-03",
      "Nov 3 2026",
      "November 3, 2026",
      "3 Nov 2026",
      "Tue, Nov 3rd 2026",
    ];
    const results = forms.map((f) => parseTypedDate(f));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(on(2026, 11, 3));
  });
});

describe("what the box shows reads back as the same day", () => {
  it("the displayed form is understood again", () => {
    const ms = on(2026, 11, 3);
    expect(shown(ms)).toBe("Nov 3, 2026");
    expect(parseTypedDate(shown(ms))).toBe(ms);
  });

  it("survives a round trip for a year of dates", () => {
    // The real guard against the two halves disagreeing: whatever the box
    // displays must parse back to the day it came from. A format the parser
    // could not read would strand anyone who clicked into the field and
    // pressed Enter without changing anything.
    for (let i = 0; i < 365; i++) {
      const d = new Date(2027, 0, 1 + i);
      const midnight = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate()
      ).getTime();
      expect(parseTypedDate(shown(midnight))).toBe(midnight);
    }
  });
});
