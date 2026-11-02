import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { CalendarPreview } from "./calendar-preview";
import type { Doc } from "../../../convex/_generated/dataModel";

/**
 * The calendar as it will print, on screen.
 *
 * The preview exists so nobody has to download the PDF to see the effect of
 * a change, which means the only thing that really matters about it is that
 * it AGREES WITH THE PDF. A preview that is a second opinion is worse than
 * no preview, because it gets believed.
 *
 * So the checks below are about agreement — same positions, same order, same
 * pinning — plus the thing it adds: moving an event without opening its form.
 */

const JAN = { year: 2027, month: 0 };

let seq = 0;
function event(e: Partial<Doc<"events">> & { name: string; day: number }): Doc<"events"> {
  seq += 1;
  const { day, ...rest } = e;
  return {
    _id: `event_${seq}` as Doc<"events">["_id"],
    _creationTime: 0,
    orgId: "org_1",
    scheduleType: "SINGLE_DAY",
    isDeleted: false,
    isApproved: true,
    date: new Date(2027, 0, day).getTime(),
    ...rest,
  } as Doc<"events">;
}

function show(events: Doc<"events">[], props: Partial<React.ComponentProps<typeof CalendarPreview>> = {}) {
  return render(
    <CalendarPreview
      events={events}
      canEdit={false}
      initialYear={JAN.year}
      initialMonth={JAN.month}
      {...props}
    />
  );
}

/** The events drawn in one day's square, in the order they are drawn. */
function squareFor(day: number): HTMLElement {
  const number = screen.getAllByText(String(day)).find((el) =>
    el.closest("[data-testid='calendar-preview']")
  );
  const square = number!.parentElement as HTMLElement;
  return square;
}

function namesIn(day: number): string[] {
  return within(squareFor(day))
    .queryAllByTestId("preview-event")
    .map((el) => el.textContent?.replace(/^\d+/, "").trim() ?? "");
}

describe("what the preview shows", () => {
  it("draws the month it was asked for", () => {
    show([]);
    expect(screen.getByTestId("preview-month").textContent).toContain("January 2027");
  });

  it("puts each event on its own day", () => {
    show([
      event({ name: "Ninth Thing", day: 9 }),
      event({ name: "Tenth Thing", day: 10 }),
    ]);
    expect(namesIn(9)).toContain("Ninth Thing");
    expect(namesIn(9)).not.toContain("Tenth Thing");
  });

  it("orders a day by position, not by when it was added", () => {
    show([
      event({ name: "Third", day: 9, printPriority: 3 } as never),
      event({ name: "First", day: 9, printPriority: 1 } as never),
      event({ name: "Second", day: 9, printPriority: 2 } as never),
    ]);
    expect(namesIn(9)).toEqual(["First", "Second", "Third"]);
  });

  it("shows each event's number, so the arrangement is readable at a glance", () => {
    show([event({ name: "Market", day: 9, printPriority: 4 } as never)]);
    const el = within(squareFor(9)).getByTestId("preview-event");
    expect(el.getAttribute("data-priority")).toBe("4");
    expect(el.textContent).toContain("4");
  });

  it("reads an event saved before this change from its old band", () => {
    // Same promise the printed calendar makes: nothing moves on shipping day.
    show([
      event({ name: "Old Bottom", day: 9, printPlacement: "BOTTOM" } as never),
      event({ name: "Old Top", day: 9, printPlacement: "TOP" } as never),
    ]);
    expect(namesIn(9)).toEqual(["Old Top", "Old Bottom"]);
    const [top, bottom] = within(squareFor(9)).getAllByTestId("preview-event");
    expect(top.getAttribute("data-priority")).toBe("1");
    expect(bottom.getAttribute("data-priority")).toBe("5");
  });

  it("keeps the empty slots, which is what pins an event to the floor", () => {
    // If the square stops drawing five slots, position 5 stops meaning the
    // bottom and the preview has stopped matching the paper.
    const { container } = show([
      event({ name: "At Five", day: 9, printPriority: 5 } as never),
    ]);
    expect(container).toBeTruthy();
    const slots = squareFor(9).querySelectorAll(":scope > div > div");
    expect(slots.length).toBe(5);
  });

  it("grows a crowded day past five", () => {
    show([
      event({ name: "One", day: 9, printPriority: 1 } as never),
      event({ name: "Seven", day: 9, printPriority: 7 } as never),
    ]);
    const slots = squareFor(9).querySelectorAll(":scope > div > div");
    expect(slots.length).toBe(7);
  });

  it("marks a school district date the way the printed calendar does", () => {
    show([event({ name: "No School", day: 9, isScusd: true } as never)]);
    const el = within(squareFor(9)).getByTestId("preview-event");
    expect(el.querySelector(".text-red-700")).not.toBeNull();
  });

  it("says when a month will be squeezed on paper", () => {
    // January 2027 needs six week-rows, so the printed page shares a row and
    // shows at most three events a day. Saying so beats a preview that looks
    // roomier than the paper will be.
    show([]);
    expect(screen.getByTestId("preview-split-note")).toBeDefined();
  });

  it("does not warn about a month that fits", () => {
    show([], { initialYear: 2027, initialMonth: 1 });
    expect(screen.queryByTestId("preview-split-note")).toBeNull();
  });
});

describe("moving between months", () => {
  it("goes forward and back", async () => {
    show([]);
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByTestId("preview-month").textContent).toContain("February 2027");
    fireEvent.click(screen.getByLabelText("Previous month"));
    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(screen.getByTestId("preview-month").textContent).toContain("December 2026");
  });
});

describe("changing a position from the preview", () => {
  it("offers nothing to click when the person may not edit", () => {
    // The whole point of the permission switches: someone who may only add
    // their own events can look at the arrangement, not rearrange it.
    show([event({ name: "Market", day: 9, printPriority: 2 } as never)]);
    const el = within(squareFor(9)).getByTestId("preview-event");
    expect(el.tagName).not.toBe("BUTTON");
  });

  it("offers nothing to click when no handler was given", () => {
    show([event({ name: "Market", day: 9 } as never)], { canEdit: true });
    const el = within(squareFor(9)).getByTestId("preview-event");
    expect(el.tagName).not.toBe("BUTTON");
  });

  it("moves an event to the position that was clicked", async () => {
    const onSetPriority = vi.fn().mockResolvedValue(undefined);
    const ev = event({ name: "Market", day: 9, printPriority: 2 } as never);
    show([ev], { canEdit: true, onSetPriority });

    fireEvent.click(within(squareFor(9)).getByTestId("preview-event"));
    fireEvent.click(await screen.findByLabelText("Move to position 4"));

    expect(onSetPriority).toHaveBeenCalledWith(ev._id, 4);
  });

  it("takes a position past five, typed in", async () => {
    // A fixed row of five buttons would mean saying no on exactly the days
    // that need the most arranging.
    const onSetPriority = vi.fn().mockResolvedValue(undefined);
    const ev = event({ name: "Market", day: 9, printPriority: 1 } as never);
    show([ev], { canEdit: true, onSetPriority });

    fireEvent.click(within(squareFor(9)).getByTestId("preview-event"));
    const box = await screen.findByLabelText("Another position");
        fireEvent.change(box, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    expect(onSetPriority).toHaveBeenCalledWith(ev._id, 7);
  });

  it("drags a silly number into range rather than refusing it", async () => {
    const onSetPriority = vi.fn().mockResolvedValue(undefined);
    const ev = event({ name: "Market", day: 9, printPriority: 3 } as never);
    show([ev], { canEdit: true, onSetPriority });

    fireEvent.click(within(squareFor(9)).getByTestId("preview-event"));
    const box = await screen.findByLabelText("Another position");
        fireEvent.change(box, { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    const [, priority] = onSetPriority.mock.calls[0];
    expect(priority).toBeLessThanOrEqual(20);
    expect(priority).toBeGreaterThan(0);
  });

  it("does not call the server when the position has not changed", async () => {
    const onSetPriority = vi.fn().mockResolvedValue(undefined);
    show([event({ name: "Market", day: 9, printPriority: 2 } as never)], {
      canEdit: true,
      onSetPriority,
    });

    fireEvent.click(within(squareFor(9)).getByTestId("preview-event"));
    fireEvent.click(await screen.findByLabelText("Move to position 2"));

    expect(onSetPriority).not.toHaveBeenCalled();
  });
});
