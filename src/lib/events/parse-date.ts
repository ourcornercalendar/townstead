/**
 * Reading a date somebody typed.
 *
 * The date fields used to be a button that opened a little calendar, and
 * nothing else. Picking "14 August 2027" from it meant clicking forward nine
 * months one month at a time. Typing it is three seconds.
 *
 * THE RULE THIS FOLLOWS: never guess. A date that is wrong by a month or a
 * year is far worse than a date that is refused, because a refusal is
 * visible and a wrong date is not — it goes quietly onto a printed calendar
 * that gets posted to people. So anything genuinely ambiguous comes back as
 * null and the field says it did not understand, rather than picking the
 * reading that happens to be likeliest.
 *
 * American order throughout: 3/11 is the 11th of March, because this is a
 * calendar for Sacramento.
 */

const MONTHS = [
  ["jan", "january"],
  ["feb", "february"],
  ["mar", "march"],
  ["apr", "april"],
  ["may"],
  ["jun", "june"],
  ["jul", "july"],
  ["aug", "august"],
  ["sep", "sept", "september"],
  ["oct", "october"],
  ["nov", "november"],
  ["dec", "december"],
];

/** 0-11 for a month name or abbreviation, else null. */
function monthFromName(word: string): number | null {
  const w = word.toLowerCase().replace(/\.$/, "");
  for (let i = 0; i < MONTHS.length; i++) {
    if (MONTHS[i].includes(w)) return i;
  }
  return null;
}

/**
 * A two-digit year, read the way every form on earth reads one: this century
 * unless that would be absurd.
 *
 * 26 -> 2026, 99 -> 2099. Nobody is entering a community event for 1999, and
 * a calendar that silently filed one in the past would be worse than one
 * that filed it in the future, where it is at least visible.
 */
function expandYear(year: number): number {
  if (year >= 100) return year;
  return 2000 + year;
}

/** Local midnight, which is what the rest of the app stores. */
function atMidnight(year: number, month: number, day: number): number | null {
  // Reject before constructing: JavaScript rolls 31 February over into March
  // without complaining, so "2/31" would quietly become the 3rd of March.
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;

  const d = new Date(year, month, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d.getTime();
}

/**
 * Parse what somebody typed into a date field.
 *
 * Returns Unix milliseconds at local midnight, or null if it could not be
 * read with confidence.
 *
 * Understood:
 *   11/3/2026   11-3-2026   11.3.2026     (month first)
 *   11/3/26     11/3                      (year assumed; see below)
 *   2026-11-03                            (ISO, year first)
 *   Nov 3 2026  November 3, 2026  Nov 3
 *   3 Nov 2026  3 November 2026
 *   today  tomorrow  yesterday
 *
 * @param fallbackYear the year to assume when none is typed. Pass the year
 *   the user is already looking at, so typing "11/3" while editing a 2027
 *   calendar means 2027 rather than whatever year it happens to be today.
 */
export function parseTypedDate(
  input: string,
  fallbackYear: number = new Date().getFullYear()
): number | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower === "today" || lower === "tomorrow" || lower === "yesterday") {
    const now = new Date();
    const offset = lower === "tomorrow" ? 1 : lower === "yesterday" ? -1 : 0;
    return atMidnight(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  }

  // Strip a leading weekday ("Tue, Nov 3") and any ordinal suffix ("3rd").
  const cleaned = raw
    .replace(
      /^(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)[a-z]*[,.]?\s+/i,
      ""
    )
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, " ")
    .trim();

  // ISO first: 2026-11-03. Unambiguous, and the only form where the year
  // leads, so it has to be tried before the month-first rules below.
  const iso = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return atMidnight(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  // 11/3/2026, 11-3-26, 11.3.2026
  const numeric = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (numeric) {
    return atMidnight(
      expandYear(Number(numeric[3])),
      Number(numeric[1]) - 1,
      Number(numeric[2])
    );
  }

  // 11/3 — no year given.
  const noYear = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (noYear) {
    return atMidnight(fallbackYear, Number(noYear[1]) - 1, Number(noYear[2]));
  }

  const words = cleaned.split(/\s+/).filter(Boolean);

  // Nov 3 2026 / November 3 / Nov 2026
  if (words.length >= 1) {
    const month = monthFromName(words[0]);
    if (month !== null) {
      if (words.length === 1) return null; // "November" alone is not a date.
      const day = Number(words[1]);
      if (!Number.isInteger(day)) return null;
      const year = words.length >= 3 ? expandYear(Number(words[2])) : fallbackYear;
      if (!Number.isInteger(year)) return null;
      return atMidnight(year, month, day);
    }
  }

  // 3 Nov 2026 / 3 November
  if (words.length >= 2) {
    const day = Number(words[0]);
    const month = monthFromName(words[1]);
    if (Number.isInteger(day) && month !== null) {
      const year = words.length >= 3 ? expandYear(Number(words[2])) : fallbackYear;
      if (!Number.isInteger(year)) return null;
      return atMidnight(year, month, day);
    }
  }

  return null;
}
