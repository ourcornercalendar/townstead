import { describe, it, expect } from "vitest";
import {
  BASE_SLOTS,
  DEFAULT_PRIORITY,
  MAX_PRIORITY,
  bySlot,
  clampPriority,
  cleanPriority,
  inPrintOrder,
  priorityOf,
  slotsForDay,
} from "./printPriority";

/**
 * Numbered positions on the printed calendar.
 *
 * The two things that would actually hurt if they broke:
 *
 *   1. an event losing its place on the printed calendar the day this
 *      shipped, because the old TOP/MIDDLE/BOTTOM stopped being understood;
 *   2. an event vanishing from a square because its number was larger than
 *      the number of slots.
 *
 * Both have a block of their own below.
 */

describe("reading a position", () => {
  it("uses the number when there is one", () => {
    expect(priorityOf({ printPriority: 4 })).toBe(4);
  });

  it("falls back to the old band, so nothing moves on shipping day", () => {
    expect(priorityOf({ printPlacement: "TOP" })).toBe(1);
    expect(priorityOf({ printPlacement: "MIDDLE" })).toBe(3);
    expect(priorityOf({ printPlacement: "BOTTOM" })).toBe(5);
  });

  it("prefers the number over a stale band left on the same event", () => {
    expect(priorityOf({ printPriority: 2, printPlacement: "BOTTOM" })).toBe(2);
  });

  it("an event with neither prints at the top, as it always did", () => {
    expect(priorityOf({})).toBe(DEFAULT_PRIORITY);
    expect(DEFAULT_PRIORITY).toBe(1);
  });

  it("ignores rubbish rather than throwing", () => {
    expect(priorityOf({ printPriority: 0 })).toBe(1);
    expect(priorityOf({ printPriority: -3 })).toBe(1);
    expect(priorityOf({ printPriority: NaN })).toBe(1);
    expect(priorityOf({ printPriority: null })).toBe(1);
    expect(priorityOf({ printPlacement: "SIDEWAYS" })).toBe(1);
  });
});

describe("cleaning and clamping", () => {
  it("accepts a number in range", () => {
    expect(cleanPriority(3)).toBe(3);
    expect(cleanPriority("4")).toBe(4);
  });

  it("refuses one out of range", () => {
    expect(cleanPriority(0)).toBe(null);
    expect(cleanPriority(MAX_PRIORITY + 1)).toBe(null);
    expect(cleanPriority("banana")).toBe(null);
    expect(cleanPriority(undefined)).toBe(null);
  });

  it("clamping drags a typed value into range instead of refusing it", () => {
    expect(clampPriority(0)).toBe(1);
    expect(clampPriority(999)).toBe(MAX_PRIORITY);
    expect(clampPriority(2.6)).toBe(3);
    expect(clampPriority("")).toBe(DEFAULT_PRIORITY);
  });
});

describe("how many slots a square gets", () => {
  it("five, which is what Joyce asked for", () => {
    expect(slotsForDay([1, 2, 3])).toBe(BASE_SLOTS);
    expect(slotsForDay([])).toBe(BASE_SLOTS);
  });

  it("more when a busy day asks for more", () => {
    // The whole point of a number rather than a list of five.
    expect(slotsForDay([1, 7])).toBe(7);
  });

  it("never past the ceiling", () => {
    expect(slotsForDay([MAX_PRIORITY + 50])).toBe(MAX_PRIORITY);
  });
});

describe("printing order", () => {
  it("1 first, then 2, and so on", () => {
    const out = inPrintOrder([
      { priority: 5, name: "e" },
      { priority: 1, name: "a" },
      { priority: 3, name: "c" },
    ]);
    expect(out.map((e) => e.name)).toEqual(["a", "c", "e"]);
  });

  it("two at the same number keep the order they were added", () => {
    const out = inPrintOrder([
      { priority: 2, name: "first added" },
      { priority: 2, name: "second added" },
      { priority: 1, name: "top" },
    ]);
    expect(out.map((e) => e.name)).toEqual([
      "top",
      "first added",
      "second added",
    ]);
  });
});

describe("pinning events into slots", () => {
  it("an event at 5 sits at the floor with empty slots above it", () => {
    // Joyce chose pinning over plain ordering. If this ever starts returning
    // one slot holding one event, the printed square has quietly become a
    // list and the choice has been undone.
    const slots = bySlot([{ priority: 5, name: "bottom" }]);
    expect(slots).toHaveLength(5);
    expect(slots[0]).toEqual([]);
    expect(slots[4].map((e) => e.name)).toEqual(["bottom"]);
  });

  it("1, 3 and 5 land where TOP, MIDDLE and BOTTOM used to", () => {
    const slots = bySlot([
      { priority: 1, name: "was TOP" },
      { priority: 3, name: "was MIDDLE" },
      { priority: 5, name: "was BOTTOM" },
    ]);
    expect(slots[0].map((e) => e.name)).toEqual(["was TOP"]);
    expect(slots[2].map((e) => e.name)).toEqual(["was MIDDLE"]);
    expect(slots[4].map((e) => e.name)).toEqual(["was BOTTOM"]);
    expect(slots[1]).toEqual([]);
    expect(slots[3]).toEqual([]);
  });

  it("a crowded day grows extra slots", () => {
    const slots = bySlot([
      { priority: 1, name: "a" },
      { priority: 7, name: "g" },
    ]);
    expect(slots).toHaveLength(7);
    expect(slots[6].map((e) => e.name)).toEqual(["g"]);
  });

  it("two events on the same number stack inside that one slot", () => {
    const slots = bySlot([
      { priority: 2, name: "first" },
      { priority: 2, name: "second" },
    ]);
    expect(slots[1].map((e) => e.name)).toEqual(["first", "second"]);
  });

  it("nothing is ever dropped from a square", () => {
    // A number past the ceiling joins the last slot rather than falling off
    // the calendar. An event missing from the printed page is the one
    // failure nobody would notice until it was in Joyce's hands on paper.
    const events = [
      { priority: 1, name: "a" },
      { priority: 3, name: "b" },
      { priority: 99, name: "c" },
      { priority: 0, name: "d" },
    ];
    const slots = bySlot(events);
    const printed = slots.flat().map((e) => e.name);
    expect(printed).toHaveLength(events.length);
    for (const e of events) expect(printed).toContain(e.name);
  });

  it("an empty day is still a grid of slots, not nothing", () => {
    expect(bySlot([])).toHaveLength(BASE_SLOTS);
    expect(bySlot([]).flat()).toEqual([]);
  });
});
