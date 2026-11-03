import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Doc } from "../../../../convex/_generated/dataModel";

/**
 * "Repeat on another date" — the same event again, on a day that follows no
 * pattern.
 *
 * The repeating-pattern builder already handles things that recur on a rule
 * ("the second Tuesday of every month"). This is for everything else: a
 * market that skips a week, a meeting moved for a holiday, a concert series
 * on dates somebody chose by hand. Those were being retyped from scratch.
 *
 * THE FAILURE THAT WOULD MATTER: a repeat quietly overwriting the event it
 * was copied from. Joyce would lose the original, and she would not find out
 * until she noticed it missing from a printed calendar. The first block
 * below is entirely about that.
 */

const { createMock, updateMock, otherMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  otherMock: vi.fn(),
}));

// Which mutation the form asked for is read from the Convex function
// reference itself, rather than from the order the hooks happen to run in.
// Order would pass today and silently point at the wrong mutation the first
// time somebody adds a `useMutation` above the others.
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name.endsWith(":create")) return createMock;
      if (name.endsWith(":update")) return updateMock;
      return otherMock;
    },
    useQuery: () => [],
  };
});

vi.mock("@/hooks/use-org", () => ({
  useOrg: () => ({ orgId: "org_1", isReady: true }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { EventForm } = await import("./event-form");

const SOURCE = {
  _id: "event_original" as Doc<"events">["_id"],
  _creationTime: 0,
  orgId: "org_1",
  name: "Farmers Market",
  description: "Old Town, rain or shine",
  date: new Date(2027, 0, 9).getTime(),
  startsOn: new Date(2027, 0, 9).getTime(),
  scheduleType: "SINGLE_DAY",
  isDeleted: false,
  isApproved: true,
  isScusd: true,
  printPriority: 4,
} as unknown as Doc<"events">;

beforeEach(() => {
  createMock.mockReset().mockResolvedValue("new_id");
  updateMock.mockReset().mockResolvedValue(undefined);
  otherMock.mockReset().mockResolvedValue(undefined);
});

function openRepeat() {
  return render(
    <EventForm
      open
      onOpenChange={() => {}}
      editing={null}
      duplicating={SOURCE}
      calendarEditions={[]}
      orgId="org_1"
    />
  );
}

describe("a repeat never touches the original", () => {
  it("creates a new event instead of updating the one copied", async () => {
    openRepeat();
    fireEvent.click(screen.getByRole("button", { name: /Save as a new event/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sends no id of the original anywhere", async () => {
    // The specific way this goes wrong: the copy carries `_id` through and
    // the server writes over the event it came from.
    openRepeat();
    fireEvent.click(screen.getByRole("button", { name: /Save as a new event/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payload = createMock.mock.calls[0][0];
    expect(payload.id).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("event_original");
  });

  it("says plainly that it is a repeat, not an edit", async () => {
    // The form looks exactly like editing the original. The one thing
    // somebody must not believe is that they are changing it.
    openRepeat();
    expect(screen.getByTestId("event-form-title").textContent).toContain(
      "Repeat"
    );
    expect(screen.getByText(/The original is untouched/i)).toBeDefined();
  });
});

describe("everything is filled in from the event being repeated", () => {
  it("carries the name across", () => {
    openRepeat();
    expect(screen.getByDisplayValue("Farmers Market")).toBeDefined();
  });

  it("carries the description across", () => {
    openRepeat();
    expect(screen.getByDisplayValue("Old Town, rain or shine")).toBeDefined();
  });

  it("carries the date across, ready to be changed", async () => {
    // Auto-populated, not blanked: Jonathan asked for everything filled in
    // "but the ability to change the date". Most repeats are near the
    // original, so the old date is the better starting point than nothing.
    openRepeat();
    const boxes = screen.getAllByTestId("date-input") as HTMLInputElement[];
    expect(boxes[0].value).toBe("Jan 9, 2027");
  });

  it("carries the printed position across", async () => {
    openRepeat();
    expect(
      screen.getByRole("button", { name: "Position 4", pressed: true })
    ).toBeDefined();
  });

  it("sends the copied fields to the server", async () => {
    openRepeat();
    fireEvent.click(screen.getByRole("button", { name: /Save as a new event/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payload = createMock.mock.calls[0][0];
    expect(payload.name).toBe("Farmers Market");
    expect(payload.description).toBe("Old Town, rain or shine");
    expect(payload.printPriority).toBe(4);
    expect(payload.isScusd).toBe(true);
    expect(payload.orgId).toBe("org_1");
  });
});

describe("changing the date on the copy", () => {
  it("saves the typed date, not the one it was copied from", async () => {
    openRepeat();
    const box = (screen.getAllByTestId("date-input") as HTMLInputElement[])[0];
    fireEvent.change(box, { target: { value: "3/14/2027" } });
    fireEvent.blur(box);

    fireEvent.click(screen.getByRole("button", { name: /Save as a new event/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalled());

    const payload = createMock.mock.calls[0][0];
    expect(payload.date).toBe(new Date(2027, 2, 14).getTime());
    expect(payload.date).not.toBe(SOURCE.date);
  });
});

describe("the ordinary modes still behave", () => {
  it("editing still updates and does not create", async () => {
    render(
      <EventForm
        open
        onOpenChange={() => {}}
        editing={SOURCE}
        calendarEditions={[]}
        orgId="org_1"
      />
    );
    expect(screen.getByTestId("event-form-title").textContent).toContain("Edit");

    fireEvent.click(screen.getByRole("button", { name: /Save Event/i }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(createMock).not.toHaveBeenCalled();
  });

  it("a brand-new event is blank, not holding the last thing copied", () => {
    render(
      <EventForm
        open
        onOpenChange={() => {}}
        editing={null}
        duplicating={null}
        calendarEditions={[]}
        orgId="org_1"
      />
    );
    expect(screen.getByTestId("event-form-title").textContent).toContain("New");
    expect(screen.queryByDisplayValue("Farmers Market")).toBeNull();
  });
});
