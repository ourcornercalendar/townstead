import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SquarePreview, type SquareDraft } from "./square-preview";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { generateCalendarPdf } from "@/lib/pdf/calendar-grid";

// One of these renders a real PDF, which takes a few seconds.
vi.setConfig({ testTimeout: 60_000 });

/**
 * The live square in the event builder.
 *
 * The one thing that would make this worse than useless is DISAGREEING with
 * the printed page — somebody arranges a square until it looks right here
 * and the PDF comes out different. So the checks below are mostly about
 * agreement: the same ordering, the same pinning, the same other events.
 *
 * It shares `buildPrintMonth` and `bySlot` with the PDF, which is what makes
 * that agreement structural rather than hopeful. These make sure the sharing
 * is real and stays real.
 */

const DAY = new Date(2027, 0, 9).getTime();

let seq = 0;
function saved(e: Partial<Doc<"events">> & { name: string }): Doc<"events"> {
  seq += 1;
  return {
    _id: `saved_${seq}` as Id<"events">,
    _creationTime: seq,
    orgId: "org_1",
    scheduleType: "SINGLE_DAY",
    isDeleted: false,
    isApproved: true,
    date: DAY,
    ...e,
  } as Doc<"events">;
}

const draft = (over: Partial<SquareDraft> = {}): SquareDraft => ({
  name: "Farmers Market",
  description: "",
  date: DAY,
  priority: 1,
  scusd: false,
  ...over,
});

function show(d: SquareDraft, others: Doc<"events">[] = [], editingId?: Id<"events">) {
  return render(
    <SquarePreview draft={d} otherEvents={others} editingId={editingId} />
  );
}

/** Every event drawn in the square, top to bottom. */
function drawn(): string[] {
  const square = screen.getByTestId("square-preview");
  return within(square)
    .queryAllByTestId(/^preview-(draft|other)$/)
    .map((el) => el.textContent ?? "");
}

describe("what the square shows", () => {
  it("draws the event being typed", () => {
    show(draft());
    expect(screen.getByTestId("preview-draft").textContent).toContain(
      "Farmers Market"
    );
  });

  it("shows the day number", () => {
    show(draft());
    expect(screen.getByTestId("square-preview").textContent).toContain("9");
  });

  it("gives an unnamed draft a placeholder rather than an empty box", () => {
    show(draft({ name: "" }));
    expect(screen.getByTestId("preview-draft").textContent).toContain(
      "Untitled event"
    );
  });

  it("shows the description under the name", () => {
    show(draft({ description: "Old Town, rain or shine" }));
    const el = screen.getByTestId("preview-draft");
    expect(el.textContent).toContain("Farmers Market");
    expect(el.textContent).toContain("Old Town, rain or shine");
  });
});

describe("the rest of that day", () => {
  it("fills in the events already on the square", () => {
    show(draft({ priority: 3 }), [
      saved({ name: "Council Meeting", printPriority: 1 } as never),
    ]);
    expect(drawn().join(" ")).toContain("Council Meeting");
  });

  it("leaves out events on other days", () => {
    show(draft(), [
      saved({ name: "Someone Else's Day", date: new Date(2027, 0, 10).getTime() }),
    ]);
    expect(drawn().join(" ")).not.toContain("Someone Else's Day");
  });

  it("counts what else is on the day", () => {
    show(draft({ priority: 2 }), [
      saved({ name: "Council Meeting", printPriority: 1 } as never),
    ]);
    expect(screen.getByTestId("square-preview").parentElement!.textContent)
      .toContain("1 other event on this day");
  });

  it("says so when the day is otherwise empty", () => {
    show(draft());
    expect(screen.getByTestId("square-preview").parentElement!.textContent)
      .toContain("Nothing else is on this day");
  });

  it("does not show the event being edited twice", () => {
    // Editing an event that is already saved: without this the square shows
    // the old copy and the draft side by side, and the person is arranging
    // against a day that does not exist.
    const existing = saved({ name: "Farmers Market", printPriority: 1 } as never);
    show(draft({ name: "Farmers Market (moved)" }), [existing], existing._id);
    const all = drawn().join(" ");
    expect(all).toContain("Farmers Market (moved)");
    expect(all).not.toContain("Farmers Market Old Town");
    expect(screen.queryAllByTestId("preview-other")).toHaveLength(0);
  });
});

describe("it agrees with the printed page", () => {
  it("orders the square by position, not by what was typed last", () => {
    show(draft({ name: "The Draft", priority: 4 }), [
      saved({ name: "At One", printPriority: 1 } as never),
      saved({ name: "At Two", printPriority: 2 } as never),
    ]);
    const order = drawn().map((t) => t.replace(/\s+/g, " ").trim());
    expect(order[0]).toContain("At One");
    expect(order[1]).toContain("At Two");
    expect(order[2]).toContain("The Draft");
  });

  it("keeps the empty positions, which is what pins 5 to the floor", () => {
    // If the square stops drawing the gaps, position 5 stops meaning the
    // bottom of the square and the preview has stopped matching paper.
    show(draft({ priority: 5 }));
    const square = screen.getByTestId("square-preview");
    const slots = square.querySelectorAll(":scope > div > div > div");
    expect(slots.length).toBe(5);
  });

  it("grows past five when the day asks for it", () => {
    show(draft({ priority: 7 }), [
      saved({ name: "At One", printPriority: 1 } as never),
    ]);
    const square = screen.getByTestId("square-preview");
    const slots = square.querySelectorAll(":scope > div > div > div");
    expect(slots.length).toBe(7);
  });

  it("reads an old event's band the way the PDF does", () => {
    // A saved event with no number still prints where it always did.
    show(draft({ priority: 1 }), [
      saved({ name: "Legacy Bottom", printPlacement: "BOTTOM" } as never),
    ]);
    const order = drawn().join(" | ");
    expect(order.indexOf("Farmers Market")).toBeLessThan(
      order.indexOf("Legacy Bottom")
    );
  });

  it("marks a school district date in red, as it prints", () => {
    show(draft({ scusd: true }));
    expect(screen.getByTestId("preview-draft").getAttribute("style")).toContain(
      "rgb(192, 20, 15)"
    );
  });

  it("expands a repeating event onto this day", () => {
    // The square has to show a weekly market that falls here, not just
    // events whose single date matches.
    show(draft({ priority: 5 }), [
      saved({
        name: "Weekly Market",
        scheduleType: "DAILY_RANGE",
        startsOn: new Date(2027, 0, 1).getTime(),
        endsOn: new Date(2027, 0, 31).getTime(),
        printPriority: 1,
      } as never),
    ]);
    expect(drawn().join(" ")).toContain("Weekly Market");
  });
});

describe("when a day will not all fit", () => {
  // The square is a fixed size on paper, so something has to give. These
  // are the same rules the printed page follows, said out loud on screen
  // rather than discovered from the finished calendar.

  it("says nothing for an ordinary day", () => {
    show(draft({ description: "Old Town, rain or shine" }));
    expect(screen.queryByTestId("square-preview-trimmed")).toBeNull();
    expect(screen.queryByTestId("square-preview-full")).toBeNull();
  });

  it("warns once the descriptions start being left off", () => {
    show(
      draft({ priority: 5, description: "Mine has a description too" }),
      [1, 2, 3, 4].map((n) =>
        saved({
          name: `Event ${n}`,
          description: "And so does this one",
          printPriority: n,
        } as never)
      )
    );
    expect(screen.getByTestId("square-preview-trimmed")).toBeDefined();
  });

  it("warns, with a count, when events will not print at all", () => {
    show(
      draft({ priority: 12 }),
      Array.from({ length: 11 }, (_, i) =>
        saved({ name: `Event ${i + 1}`, printPriority: i + 1 } as never)
      )
    );
    const note = screen.getByTestId("square-preview-full");
    expect(note.textContent).toContain("5 events");
    expect(note.textContent).toContain("+5 more");
  });

  it("stops drawing the events that will not print", () => {
    show(
      draft({ priority: 12 }),
      Array.from({ length: 11 }, (_, i) =>
        saved({ name: `Event ${i + 1}`, printPriority: i + 1 } as never)
      )
    );
    // Seven print; the eighth line is given over to the marker.
    expect(drawn()).toHaveLength(7);
  });
});

describe("before a date is chosen", () => {
  it("asks for one instead of drawing a nonsense square", () => {
    show(draft({ date: Number.NaN }));
    expect(screen.queryByTestId("square-preview")).toBeNull();
    expect(screen.getByText(/Pick a date/)).toBeDefined();
  });
});

describe("the preview and the PDF agree", () => {
  /** The order text appears down the page in a rendered PDF. */
  async function printedOrder(events: Doc<"events">[]): Promise<string[]> {
    const pdf = await generateCalendarPdf({
      year: 2027,
      events,
      editionLabel: "Elk Grove",
      calendarEditionId: null,
    });
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const file = join(mkdtempSync(join(tmpdir(), "sq-")), "cal.pdf");
    writeFileSync(file, pdf);
    const script = `
import json, pymupdf
doc = pymupdf.open(${JSON.stringify("__FILE__")})
out = []
for block in doc[0].get_text("dict")["blocks"]:
    for line in block.get("lines", []):
        for s in line["spans"]:
            out.append({"text": s["text"], "y": s["bbox"][1]})
print(json.dumps(out))
`.replace("__FILE__", file);
    const raw = execFileSync("python3", ["-c", script], { encoding: "utf8" });
    return (JSON.parse(raw) as { text: string; y: number }[])
      .sort((a, b) => a.y - b.y)
      .map((s) => s.text);
  }

  it("puts the same events in the same order as the printed square", async () => {
    // THE CHECK THIS COMPONENT EXISTS FOR. If the preview and the page ever
    // disagree, somebody arranges a square until it looks right here and
    // the calendar comes out different — which is worse than having no
    // preview, because this one gets believed.
    // TWO events share position 2 on purpose. With one event per position
    // the ordering is forced by the position alone, so any sort at all
    // would "agree" — an earlier version of this test passed happily with
    // the preview sorting alphabetically. Where two share a number, the
    // order they were added decides, and that is what can drift.
    const others = [
      saved({ name: "Zulu Added First", printPriority: 2 } as never),
      saved({ name: "Alpha Added Second", printPriority: 2 } as never),
      saved({ name: "Solo At One", printPriority: 1 } as never),
    ];
    const d = draft({ name: "The Draft At Two", priority: 2 });

    show(d, others);
    const onScreen = drawn().map((t) => t.replace(/\s+/g, " ").trim());

    // The same events in the same order the preview feeds them, straight
    // to the PDF.
    const onPaper = await printedOrder([
      ...others,
      saved({
        name: "The Draft At Two",
        printPriority: 2,
        date: DAY,
      } as never),
    ]);

    const names = [
      "Solo At One",
      "Zulu Added First",
      "Alpha Added Second",
      "The Draft At Two",
    ];
    const orderIn = (haystack: string[]) =>
      names
        .map((n) => ({ n, at: haystack.findIndex((t) => t.includes(n)) }))
        .sort((a, b) => a.at - b.at)
        .map((x) => x.n);

    const paperOrder = orderIn(onPaper);
    const screenOrder = orderIn(onScreen);

    expect(paperOrder, "the PDF itself").toEqual(names);
    expect(screenOrder, "the preview against the PDF").toEqual(paperOrder);
  });
});

describe("editing an event keeps its place in the queue", () => {
  it("an older event still prints above a newer one at the same position", () => {
    // Two events share position 2. The older was added first, so it prints
    // first — and must go on doing so while it is being edited. Dropping
    // the draft on the end of the list instead would quietly swap them.
    const older = saved({ name: "Written Last Year", printPriority: 2 } as never);
    const newer = saved({ name: "Written Yesterday", printPriority: 2 } as never);

    show(
      draft({ name: "Written Last Year (edited)", priority: 2 }),
      [older, newer],
      older._id
    );

    const order = drawn().map((t) => t.replace(/\s+/g, " ").trim());
    expect(order[0]).toContain("Written Last Year (edited)");
    expect(order[1]).toContain("Written Yesterday");
  });
});
