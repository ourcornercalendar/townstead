import { describe, it, expect } from "vitest";
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
 *   - each event sits in the top, middle or bottom third, as Joyce chooses
 *   - school district dates print in red
 */

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
    const pdf = await renderJanuary([
      event({ name: "Farmers Market", description: "Old Town, 8am to noon", date: day(2027, 0, 9), printPlacement: "TOP" } as TestEvent),
      event({ name: "Story Hour", description: "All ages welcome", date: day(2027, 0, 9), printPlacement: "BOTTOM" } as TestEvent),
      event({ name: "No School", description: "All SCUSD campuses closed", date: day(2027, 0, 14), printPlacement: "MIDDLE", isScusd: true } as TestEvent),
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
