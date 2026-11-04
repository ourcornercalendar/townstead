import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { generateCalendarPdf } from "./calendar-grid";
import type { Doc } from "../../../convex/_generated/dataModel";

/**
 * The printed calendar square.
 *
 * This is the artefact Joyce sends to her designer, so it is worth rendering a
 * real PDF and reading the words back out of it rather than trusting that the
 * JSX looks right. Everything below is asserted against the actual output of
 * @react-pdf/renderer.
 *
 * What the square now does:
 *   - the event name is set in bold, its description in regular beneath
 *   - the time is not printed at all
 *   - each event sits at its numbered position, 1 at the top of the square
 *     down to the floor, and those positions are pinned rather than merely
 *     ordered
 *   - school district dates print in red
 */

/**
 * These render real PDFs, and the FIRST one in the file also pays for
 * @react-pdf/renderer's font registration and layout warm-up — around twelve
 * seconds on a cold machine, against a 5s default. Whichever test happened
 * to run first would fail intermittently, for no reason connected to what
 * it actually checks.
 */
vi.setConfig({ testTimeout: 60_000 });

const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

type TestEvent = Partial<Doc<"events">> & { name: string; date: number };

let seq = 0;
function event(e: TestEvent): Doc<"events"> {
  seq += 1;
  return {
    _id: `event_${seq}` as Doc<"events">["_id"],
    _creationTime: 0,
    orgId: "org_1",
    scheduleType: "SINGLE_DAY",
    isDeleted: false,
    ...e,
  } as Doc<"events">;
}

async function renderJanuary(events: Doc<"events">[]) {
  const buffer = await generateCalendarPdf({
    year: 2027,
    events,
    editionLabel: "Community Calendar",
    calendarEditionId: null,
  });
  return buffer;
}

describe("the printed calendar square", () => {
  it("prints the name and the description, and never the time", async () => {
    const pdf = await renderJanuary([
      event({
        name: "Farmers Market",
        description: "Old Town, rain or shine",
        startTime: "8:00 AM",
        endTime: "12:00 PM",
        date: day(2027, 0, 9),
      }),
    ]);

    const text = await pdfText(pdf);
    expect(text).toContain("Farmers Market");
    expect(text).toContain("Old Town, rain or shine");
    // The times were set on the event and must not reach the paper.
    expect(text).not.toContain("8:00 AM");
    expect(text).not.toContain("12:00 PM");
  });

  it("sets the name in bold and the description in regular", async () => {
    const pdf = await renderJanuary([
      event({
        name: "Farmers Market",
        description: "Old Town",
        date: day(2027, 0, 9),
      }),
    ]);

    const spans = await pdfSpans(pdf);
    const title = spans.find((s) => s.text.includes("Farmers Market"));
    const description = spans.find((s) => s.text.includes("Old Town"));

    expect(title?.bold).toBe(true);
    expect(description?.bold).toBe(false);
  });

  it("puts a school district date in red, name and description both", async () => {
    const pdf = await renderJanuary([
      event({
        name: "No School",
        description: "All campuses closed",
        date: day(2027, 0, 14),
        isScusd: true,
      } as TestEvent),
    ]);

    const spans = await pdfSpans(pdf);
    const title = spans.find((s) => s.text.includes("No School"));
    const description = spans.find((s) => s.text.includes("All campuses"));

    expect(title?.red).toBe(true);
    expect(description?.red).toBe(true);
  });

  it("leaves an ordinary event in black", async () => {
    const pdf = await renderJanuary([
      event({ name: "Farmers Market", date: day(2027, 0, 9) }),
    ]);
    const spans = await pdfSpans(pdf);
    expect(spans.find((s) => s.text.includes("Farmers Market"))?.red).toBe(false);
  });

  it("places top, middle and bottom in that vertical order within one square", async () => {
    const pdf = await renderJanuary([
      // Deliberately added out of order: placement decides, not entry order.
      event({ name: "Bottom Thing", date: day(2027, 0, 9), printPlacement: "BOTTOM" } as TestEvent),
      event({ name: "Top Thing", date: day(2027, 0, 9), printPlacement: "TOP" } as TestEvent),
      event({ name: "Middle Thing", date: day(2027, 0, 9), printPlacement: "MIDDLE" } as TestEvent),
    ]);

    const spans = await pdfSpans(pdf);
    const y = (needle: string) =>
      spans.find((s) => s.text.includes(needle))!.y;

    expect(y("Top Thing")).toBeLessThan(y("Middle Thing"));
    expect(y("Middle Thing")).toBeLessThan(y("Bottom Thing"));
  });

  it("separates the bands by real distance, not just order", async () => {
    // The point of the feature: "middle" is the middle of the square. If the
    // bands collapsed, these three would sit a couple of points apart.
    const pdf = await renderJanuary([
      event({ name: "Top Thing", date: day(2027, 0, 9), printPlacement: "TOP" } as TestEvent),
      event({ name: "Bottom Thing", date: day(2027, 0, 9), printPlacement: "BOTTOM" } as TestEvent),
    ]);

    const spans = await pdfSpans(pdf);
    const top = spans.find((s) => s.text.includes("Top Thing"))!.y;
    const bottom = spans.find((s) => s.text.includes("Bottom Thing"))!.y;
    expect(bottom - top).toBeGreaterThan(20);
  });

  it("stacks two events that share a band", async () => {
    const pdf = await renderJanuary([
      event({ name: "First Up", date: day(2027, 0, 9), printPlacement: "TOP" } as TestEvent),
      event({ name: "Second Up", date: day(2027, 0, 9), printPlacement: "TOP" } as TestEvent),
    ]);

    const spans = await pdfSpans(pdf);
    const first = spans.find((s) => s.text.includes("First Up"))!;
    const second = spans.find((s) => s.text.includes("Second Up"))!;
    expect(first.y).toBeLessThan(second.y);
    // Stacked, not overlapping.
    expect(second.y - first.y).toBeGreaterThan(4);
  });

  it("treats an event saved before this feature as a top-of-square event", async () => {
    // Every one of Joyce's existing events has no placement. They must keep
    // printing where they always did.
    const pdf = await renderJanuary([
      event({ name: "Legacy Event", date: day(2027, 0, 9) }),
      event({ name: "Bottom Thing", date: day(2027, 0, 9), printPlacement: "BOTTOM" } as TestEvent),
    ]);

    const spans = await pdfSpans(pdf);
    const legacy = spans.find((s) => s.text.includes("Legacy Event"))!.y;
    const bottom = spans.find((s) => s.text.includes("Bottom Thing"))!.y;
    expect(legacy).toBeLessThan(bottom);
  });

  // ── NUMBERED POSITIONS ────────────────────────────────────────────────
  //
  // The three bands became numbers: 1 at the top of the square, down to the
  // floor. Joyce asked that the positions stay PINNED rather than merely
  // ordered, and that a busy day be allowed past five.

  it("prints 1, 2, 3 down the square in that order", async () => {
    const pdf = await renderJanuary([
      // Added out of order on purpose: the number decides, not entry order.
      event({ name: "Third Thing", date: day(2027, 0, 9), printPriority: 3 } as TestEvent),
      event({ name: "First Thing", date: day(2027, 0, 9), printPriority: 1 } as TestEvent),
      event({ name: "Second Thing", date: day(2027, 0, 9), printPriority: 2 } as TestEvent),
    ]);

    const spans = await pdfSpans(pdf);
    const y = (needle: string) => spans.find((s) => s.text.includes(needle))!.y;
    expect(y("First Thing")).toBeLessThan(y("Second Thing"));
    expect(y("Second Thing")).toBeLessThan(y("Third Thing"));
  });

  it("holds position 5 at the floor even when it is the only event", async () => {
    // THE CHOICE JOYCE MADE. Ordering alone would float this to the top,
    // because there is nothing above it. If this test starts failing, the
    // square has quietly become a list.
    const alone = await renderJanuary([
      event({ name: "Bottom Only", date: day(2027, 0, 9), printPriority: 5 } as TestEvent),
    ]);
    const top = await renderJanuary([
      event({ name: "Bottom Only", date: day(2027, 0, 9), printPriority: 1 } as TestEvent),
    ]);

    const yOf = async (pdf: Buffer) =>
      (await pdfSpans(pdf)).find((s) => s.text.includes("Bottom Only"))!.y;

    expect(await yOf(alone)).toBeGreaterThan((await yOf(top)) + 20);
  });

  it("keeps real distance between the numbers, not just order", async () => {
    const pdf = await renderJanuary([
      event({ name: "At One", date: day(2027, 0, 9), printPriority: 1 } as TestEvent),
      event({ name: "At Five", date: day(2027, 0, 9), printPriority: 5 } as TestEvent),
    ]);
    const spans = await pdfSpans(pdf);
    const one = spans.find((s) => s.text.includes("At One"))!.y;
    const five = spans.find((s) => s.text.includes("At Five"))!.y;
    expect(five - one).toBeGreaterThan(20);
  });

  it("puts 1, 3 and 5 where TOP, MIDDLE and BOTTOM used to go", async () => {
    // The migration promise: the next calendar prints like the last one.
    // Rendered as two separate months and compared position by position.
    const bands = await renderJanuary([
      event({ name: "Alpha", date: day(2027, 0, 9), printPlacement: "TOP" } as TestEvent),
      event({ name: "Beta", date: day(2027, 0, 9), printPlacement: "MIDDLE" } as TestEvent),
      event({ name: "Gamma", date: day(2027, 0, 9), printPlacement: "BOTTOM" } as TestEvent),
    ]);
    const numbers = await renderJanuary([
      event({ name: "Alpha", date: day(2027, 0, 9), printPriority: 1 } as TestEvent),
      event({ name: "Beta", date: day(2027, 0, 9), printPriority: 3 } as TestEvent),
      event({ name: "Gamma", date: day(2027, 0, 9), printPriority: 5 } as TestEvent),
    ]);

    const ys = async (pdf: Buffer) => {
      const spans = await pdfSpans(pdf);
      return ["Alpha", "Beta", "Gamma"].map(
        (n) => spans.find((s) => s.text.includes(n))!.y
      );
    };
    const [a1, b1, c1] = await ys(bands);
    const [a2, b2, c2] = await ys(numbers);
    expect(a2).toBeCloseTo(a1, 1);
    expect(b2).toBeCloseTo(b1, 1);
    expect(c2).toBeCloseTo(c1, 1);
  });

  it("a number wins over an old band left on the same event", async () => {
    const pdf = await renderJanuary([
      event({
        name: "Renumbered",
        date: day(2027, 0, 9),
        printPlacement: "BOTTOM",
        printPriority: 1,
      } as TestEvent),
      event({ name: "Anchor", date: day(2027, 0, 9), printPriority: 5 } as TestEvent),
    ]);
    const spans = await pdfSpans(pdf);
    const renumbered = spans.find((s) => s.text.includes("Renumbered"))!.y;
    const anchor = spans.find((s) => s.text.includes("Anchor"))!.y;
    expect(renumbered).toBeLessThan(anchor);
  });

  it("lets a crowded day go past five", async () => {
    // A fixed list of five would have meant telling Joyce "no" on exactly
    // the days that need the most arranging.
    const pdf = await renderJanuary([
      event({ name: "Pos One", date: day(2027, 0, 9), printPriority: 1 } as TestEvent),
      event({ name: "Pos Six", date: day(2027, 0, 9), printPriority: 6 } as TestEvent),
      event({ name: "Pos Seven", date: day(2027, 0, 9), printPriority: 7 } as TestEvent),
    ]);
    const spans = await pdfSpans(pdf);
    const y = (needle: string) => spans.find((s) => s.text.includes(needle))!.y;
    expect(y("Pos One")).toBeLessThan(y("Pos Six"));
    expect(y("Pos Six")).toBeLessThan(y("Pos Seven"));
  });

  it("prints every event on a crowded day, dropping none", async () => {
    // The one failure nobody would notice until the calendar was on paper.
    const names = Array.from({ length: 8 }, (_, i) => `Event Number ${i + 1}`);
    const pdf = await renderJanuary(
      names.map((name, i) =>
        event({ name, date: day(2027, 0, 9), printPriority: i + 1 } as TestEvent)
      )
    );
    const text = await pdfText(pdf);
    for (const name of names) expect(text).toContain(name);
  });

  it("still renders a month whose squares are squeezed together", async () => {
    // January 2027 needs six week rows, so the last two share a cell.
    const pdf = await renderJanuary([
      event({ name: "Month End Thing", description: "in a tight square", date: day(2027, 0, 31) }),
    ]);
    const text = await pdfText(pdf);
    expect(text).toContain("Month End Thing");
  });

  it("produces twelve pages", async () => {
    const pdf = await renderJanuary([]);
    const doc = await openPdf(pdf);
    expect(doc.pages).toBe(12);
  });

  // ── NOTHING PRINTS ON TOP OF ANYTHING ELSE ───────────────────────────
  //
  // Joyce downloaded a year and the squares came out smudged: an event's
  // description written over its own name, and "2027 Elk Grove" stacked
  // into an unreadable blob in the corner. It had been happening before the
  // numbered positions went in — those made it worse, not new.
  //
  // Two separate causes, both invisible in the JSX:
  //
  //   1. A wrapping <Text> reports a ONE-LINE height to the layout, so a
  //      sibling <Text> beneath it was positioned under the first line and
  //      the rest of the name was drawn through it. The name and its
  //      description are now one text flow, which lays out correctly.
  //   2. lineHeight was 1.2 and 1.15 against a glyph box of about 1.38 of
  //      the font size, so consecutive lines of the SAME text overlapped
  //      by a point and a half and looked bruised.
  //
  // This checks the only thing that actually matters about either: that no
  // two pieces of text share the same patch of paper.

  /** Every pair of spans whose boxes genuinely cover each other. */
  function collisions(spans: Span[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const a = spans[i];
        const b = spans[j];
        // A point and a half of slack: glyph boxes carry a little padding
        // above and below the ink, and touching is not colliding.
        const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        const horizontal = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        if (vertical > 1.5 && horizontal > 1.5) {
          out.push(`"${a.text.trim()}" over "${b.text.trim()}"`);
        }
      }
    }
    return out;
  }

  it("never prints two pieces of text on top of each other", async () => {
    // The exact month Joyce downloaded: long names, long descriptions,
    // school dates in red.
    const pdf = await renderJanuary([
      event({
        name: "EGUSD Track A, Track B, Track D Resumes School",
        description: "School resumes for Tracks A, B, & D after the winter break.",
        date: day(2027, 0, 4),
        isScusd: true,
      } as TestEvent),
      event({
        name: "EGUSD Traditional Resumes School",
        description: "Traditional calendar students return to school after the winter break.",
        date: day(2027, 0, 5),
        isScusd: true,
      } as TestEvent),
      event({
        name: "EGUSD Mod T Resumes School",
        description: "Modified traditional students return to school after winter break.",
        date: day(2027, 0, 12),
        isScusd: true,
      } as TestEvent),
      event({ name: "EGUSD No School", date: day(2027, 0, 18), isScusd: true } as TestEvent),
      event({ name: "Happy Birthday Kylie Edwards!", date: day(2027, 0, 27) } as TestEvent),
    ]);

    const found = collisions(await pdfSpans(pdf));
    expect(found, found.join("\n")).toEqual([]);
  });

  it("keeps a crowded square readable too", async () => {
    // Several events on one day, each with a description, which is where
    // the square has least room to give.
    const pdf = await renderJanuary(
      [1, 2, 3, 4].map((n) =>
        event({
          name: `Something With A Fairly Long Name Number ${n}`,
          description: "And a description that will certainly need more than one line to print.",
          date: day(2027, 0, 9),
          printPriority: n,
        } as TestEvent)
      )
    );
    const found = collisions(await pdfSpans(pdf));
    expect(found, found.join("\n")).toEqual([]);
  });

  it("keeps a very full square from printing across the week below", async () => {
    // What the smeared download actually looked like: text from one day
    // running down over the following week's numbers. Nothing "overlaps" a
    // neighbour in an empty square, so the collision check above cannot see
    // this — it needs measuring against the row.
    const pdf = await renderJanuary(
      [1, 2, 3, 4, 5, 6].map((n) =>
        event({
          name: `Quite A Long Event Name Number ${n}`,
          description:
            "With a description long enough to need three or four lines of its own on the page.",
          date: day(2027, 0, 9),
          printPriority: n,
        } as TestEvent)
      )
    );
    const spans = await pdfSpans(pdf);

    // The 9th is in the second week; the 10th starts the third. Anything
    // belonging to the 9th must finish above where the 10th begins.
    const nextRowTop = Math.min(
      ...["10", "11", "12", "13", "14", "15", "16"]
        .map((d) => spans.find((s) => s.text.trim() === d)?.y)
        .filter((y): y is number => typeof y === "number")
    );
    expect(Number.isFinite(nextRowTop)).toBe(true);

    const spilled = spans
      .filter((s) => s.text.includes("Quite A Long") || s.text.includes("description long"))
      .filter((s) => s.bottom > nextRowTop);
    expect(spilled.map((s) => s.text), "printed into the week below").toEqual([]);
  });

  it("leaves more leading than the type itself takes up", async () => {
    // The second of the two faults behind the smeared download, and a
    // precise one: lineHeight was 1.2 on the name and 1.15 on the
    // description, while Helvetica's glyph box here measures about 1.38 of
    // the font size. Every line was drawn a point and a half into the one
    // above it. Too small to call a collision, too big to read comfortably,
    // so it is measured directly rather than left to the tolerance the
    // check above allows.
    const pdf = await renderJanuary([
      event({
        name: "A Name Quite Long Enough To Need Three Lines All By Itself Here",
        description:
          "And a description also long enough that it has to wrap more than once.",
        date: day(2027, 0, 9),
      } as TestEvent),
    ]);
    const spans = await pdfSpans(pdf);

    // Picked out by POINT SIZE, not by words. An earlier version of this
    // hunted for phrases, and two of them straddled a line break — so it
    // compared the first line against the third, found a healthy gap, and
    // passed while the real lines overlapped.
    const linesAt = (size: number) =>
      spans.filter((s) => s.size === size).sort((a, b) => a.y - b.y);

    for (const [what, size] of [
      ["the name", 8],
      ["the description", 7.5],
    ] as const) {
      const lines = linesAt(size);
      expect(lines.length, `expected several lines of ${what}`).toBeGreaterThan(1);
      for (let i = 1; i < lines.length; i++) {
        const gap = lines[i].y - lines[i - 1].bottom;
        expect(
          gap,
          `${what}: "${lines[i - 1].text.trim()}" and "${lines[i].text.trim()}" overlap by ${(-gap).toFixed(2)}pt`
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("prints the edition on one line, not stacked in the corner", async () => {
    // It is absolutely positioned in a header whose centred month title
    // leaves it almost no width, so it wrapped to three lines drawn on top
    // of one another: "2027 Elk Grove" read as "2027 / Elk".
    const pdf = await generateCalendarPdf({
      year: 2027,
      events: [],
      editionLabel: "Elk Grove",
      calendarEditionId: null,
    });
    const spans = await pdfSpans(pdf);
    const edition = spans.find((s) => s.text.includes("2027"));
    expect(edition).toBeDefined();
    expect(edition!.text.replace(/\s+/g, " ").trim()).toBe("2027 Elk Grove");
    expect(collisions(spans)).toEqual([]);
  });

  it("sets the name in bold and the description in regular", async () => {
    // The description is nested inside the name's Text so the two lay out
    // as one flow — which means it inherits bold unless told otherwise.
    // The whole point of the bold is that the eye finds the name first.
    const pdf = await renderJanuary([
      event({
        name: "Farmers Market",
        description: "Old Town, rain or shine",
        date: day(2027, 0, 9),
      } as TestEvent),
    ]);
    const spans = await pdfSpans(pdf);
    expect(spans.find((s) => s.text.includes("Farmers Market"))?.bold).toBe(true);
    expect(spans.find((s) => s.text.includes("rain or shine"))?.bold).toBe(false);
  });

  it("writes a copy to look at", async () => {
    // Deliberately a mixture: numbered positions, a day crowded past five, a
    // day holding nothing but a 5, school district dates, and two events
    // saved before numbers existed. Whoever changes this file should open
    // the result and look at it rather than trust the coordinates.
    const pdf = await renderJanuary([
      event({ name: "Farmers Market", description: "Old Town, 8am to noon", date: day(2027, 1, 6), printPriority: 1 } as TestEvent),
      event({ name: "Story Hour", description: "All ages welcome", date: day(2027, 1, 6), printPriority: 3 } as TestEvent),
      event({ name: "Council Meeting", date: day(2027, 1, 6), printPriority: 5 } as TestEvent),

      event({ name: "Pancake Breakfast", date: day(2027, 1, 13), printPriority: 1 } as TestEvent),
      event({ name: "Craft Fair", date: day(2027, 1, 13), printPriority: 2 } as TestEvent),
      event({ name: "Open Mic", date: day(2027, 1, 13), printPriority: 3 } as TestEvent),
      event({ name: "Quiz Night", date: day(2027, 1, 13), printPriority: 4 } as TestEvent),
      event({ name: "Fireworks", date: day(2027, 1, 13), printPriority: 5 } as TestEvent),
      event({ name: "Late Addition", date: day(2027, 1, 13), printPriority: 6 } as TestEvent),
      event({ name: "Even Later", date: day(2027, 1, 13), printPriority: 7 } as TestEvent),

      event({ name: "No School", description: "All SCUSD campuses closed", date: day(2027, 1, 17), printPriority: 1, isScusd: true } as TestEvent),
      event({ name: "Legacy Top", date: day(2027, 1, 20), printPlacement: "TOP" } as TestEvent),
      event({ name: "Legacy Bottom", date: day(2027, 1, 20), printPlacement: "BOTTOM" } as TestEvent),
      event({ name: "Only At Five", date: day(2027, 1, 24), printPriority: 5 } as TestEvent),
    ]);
    mkdirSync("/tmp/out", { recursive: true });
    writeFileSync("/tmp/out/calendar-sample.pdf", pdf);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

/* ── reading the PDF back ──────────────────────────────────────────────────── */

type Span = {
  text: string;
  /** Top of the glyph box. */
  y: number;
  /** Bottom of the glyph box — needed to tell whether two lines collide. */
  bottom: number;
  x: number;
  right: number;
  bold: boolean;
  red: boolean;
  /** Point size, which is how the event name (8) is told from its
   *  description (7.5) without guessing at their words. */
  size: number;
};

async function openPdf(buffer: Buffer): Promise<{ pages: number; spans: Span[] }> {
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const dir = mkdtempSync(join(tmpdir(), "cal-"));
  const file = join(dir, "cal.pdf");
  writeFileSync(file, buffer);

  const script = `
import json, pymupdf
doc = pymupdf.open(${JSON.stringify(file)})
spans = []
page = doc[0]
for block in page.get_text("dict")["blocks"]:
    for line in block.get("lines", []):
        for s in line["spans"]:
            spans.append({
                "text": s["text"],
                "y": s["bbox"][1],
                "bottom": s["bbox"][3],
                "x": s["bbox"][0],
                "right": s["bbox"][2],
                "bold": "Bold" in s["font"],
                "size": round(s["size"], 2),
                "red": s["color"] != 0 and (s["color"] >> 16 & 255) > 120 and (s["color"] & 255) < 120,
            })
print(json.dumps({"pages": doc.page_count, "spans": spans}))
`;
  const out = execFileSync("python3", ["-c", script], { encoding: "utf8" });
  return JSON.parse(out);
}

async function pdfSpans(buffer: Buffer): Promise<Span[]> {
  return (await openPdf(buffer)).spans;
}

async function pdfText(buffer: Buffer): Promise<string> {
  return (await pdfSpans(buffer)).map((s) => s.text).join("\n");
}
