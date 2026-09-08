import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * The working year should be the calendar Joyce is currently selling.
 *
 * She sells ads for next year's printed calendar, so "next year" is the year
 * she is working in almost every day. The default was already written as
 * `getFullYear() + 1` -- and she was still being shown 2026 in September 2026.
 *
 * The reason is that the choice is persisted. The value written to storage in
 * 2025 was 2026, which was correct then and quietly wrong from 1 January 2026
 * onwards. Nothing ever moved it on, so the default aged into the past and
 * stayed there.
 *
 * These tests are about the rehydration rule that fixes that: a stored year
 * behind the coming year is caught up; a stored year further ahead is left
 * alone, because that one is a deliberate choice.
 */

const THIS_YEAR = new Date().getFullYear();
const COMING_YEAR = THIS_YEAR + 1;

async function freshStore() {
  vi.resetModules();
  const mod = await import("./use-year-store");
  return mod;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.resetModules();
});

describe("the year Joyce is working in", () => {
  it("starts on the coming year", async () => {
    const { useYearStore } = await freshStore();
    expect(useYearStore.getState().defaultYear).toBe(COMING_YEAR);
  });

  it("catches up a year saved in a previous season", async () => {
    // Exactly Joyce's case: 2026 written last year, still 2026 today.
    localStorage.setItem(
      "planner-default-year",
      JSON.stringify({ state: { defaultYear: THIS_YEAR }, version: 0 })
    );

    const { useYearStore } = await freshStore();
    await new Promise((r) => setTimeout(r, 0));
    expect(useYearStore.getState().defaultYear).toBe(COMING_YEAR);
  });

  it("catches up a year saved several seasons ago", async () => {
    localStorage.setItem(
      "planner-default-year",
      JSON.stringify({ state: { defaultYear: THIS_YEAR - 3 }, version: 0 })
    );

    const { useYearStore } = await freshStore();
    await new Promise((r) => setTimeout(r, 0));
    expect(useYearStore.getState().defaultYear).toBe(COMING_YEAR);
  });

  it("leaves a year she has deliberately set further ahead", async () => {
    // Planning the 2029 calendar early is a real thing to do, and not
    // something to undo on her behalf every time the page loads.
    localStorage.setItem(
      "planner-default-year",
      JSON.stringify({ state: { defaultYear: COMING_YEAR + 2 }, version: 0 })
    );

    const { useYearStore } = await freshStore();
    await new Promise((r) => setTimeout(r, 0));
    expect(useYearStore.getState().defaultYear).toBe(COMING_YEAR + 2);
  });

  it("still lets her change it within a session", async () => {
    const { useYearStore } = await freshStore();
    useYearStore.getState().setDefaultYear(THIS_YEAR);
    expect(useYearStore.getState().defaultYear).toBe(THIS_YEAR);
  });

  it("survives nonsense in storage", async () => {
    localStorage.setItem("planner-default-year", "not json at all");
    const { useYearStore } = await freshStore();
    expect(useYearStore.getState().defaultYear).toBe(COMING_YEAR);
  });
});
