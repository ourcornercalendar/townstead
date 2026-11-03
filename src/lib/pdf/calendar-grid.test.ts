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

type Span = { text: string; y: number; bold: boolean; red: boolean };

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
                "bold": "Bold" in s["font"],
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
