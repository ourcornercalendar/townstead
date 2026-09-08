import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The calendar year Joyce is working in.
 *
 * She sells advertising for *next* year's printed calendar: through 2026 she
 * is filling the 2027 edition, sending the artwork to the printer, and posting
 * it out. So the year every screen should open on is the coming one, not the
 * one on the wall.
 *
 * That was always the intent -- the initial value has been `getFullYear() + 1`
 * from the start. The bug was that the choice is remembered between visits and
 * nothing ever moved it on: the 2026 written to her browser during 2025 was
 * right at the time and quietly wrong from 1 January 2026, so by September she
 * was still being shown a calendar she had already sold, printed and mailed.
 */

/** The calendar currently being sold. */
export function comingYear(): number {
  return new Date().getFullYear() + 1;
}

interface YearState {
  defaultYear: number;
  setDefaultYear: (year: number) => void;
}

export const useYearStore = create<YearState>()(
  persist(
    (set) => ({
      defaultYear: comingYear(),
      setDefaultYear: (year) => set({ defaultYear: year }),
    }),
    {
      name: "planner-default-year",

      /**
       * Catch up a year saved in an earlier season, and only that.
       *
       * Behind the coming year means the saved value has been overtaken by the
       * calendar turning over. Nobody chooses to start work on an edition that
       * has already been printed and mailed, so it is moved on.
       *
       * Ahead of it is left exactly as it is. Starting the 2029 edition early
       * is a real thing to do, and undoing that on every page load would be
       * this same bug pointing the other way.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (typeof state.defaultYear !== "number" || state.defaultYear < comingYear()) {
          state.setDefaultYear(comingYear());
        }
      },
    }
  )
);
