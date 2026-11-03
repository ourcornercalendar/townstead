import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatePicker } from "./date-picker";

/**
 * Typing a date instead of clicking nine months forward.
 *
 * The parser has its own tests. These are about the box around it, and
 * specifically about the two ways a typed field goes wrong:
 *
 *   - it reports a half-typed value upwards, so "11/3/2" is saved as 2002;
 *   - it wipes what somebody typed when it does not understand it, so they
 *     lose the date and have to remember it again.
 */

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

function show(props: Partial<React.ComponentProps<typeof DatePicker>> = {}) {
  const onChange = vi.fn();
  render(<DatePicker onChange={onChange} {...props} />);
  return { onChange, input: screen.getByTestId("date-input") as HTMLInputElement };
}

describe("showing a date", () => {
  it("shows the one it was given", () => {
    const { input } = show({ value: on(2026, 11, 3) });
    expect(input.value).toBe("Nov 3, 2026");
  });

  it("is empty when there is none", () => {
    const { input } = show();
    expect(input.value).toBe("");
  });

  it("still offers the calendar button", () => {
    show();
    expect(screen.getByLabelText("Open calendar")).toBeDefined();
  });
});

describe("typing one in", () => {
  it("accepts slashes", () => {
    const { onChange, input } = show();
    fireEvent.change(input, { target: { value: "11/3/2026" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(on(2026, 11, 3));
  });

  it("accepts a month name", () => {
    const { onChange, input } = show();
    fireEvent.change(input, { target: { value: "November 3, 2026" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(on(2026, 11, 3));
  });

  it("takes Enter as well as leaving the field", () => {
    const { onChange, input } = show();
    fireEvent.change(input, { target: { value: "11/3/2026" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(on(2026, 11, 3));
  });

  it("does NOT report anything while it is still being typed", () => {
    // The bug this is here for: reading the box on every keystroke means
    // "11/3/2026" passes through "11/3/2", which is a real date in 2002.
    const { onChange, input } = show();
    for (const partial of ["1", "11", "11/", "11/3", "11/3/", "11/3/2"]) {
      fireEvent.change(input, { target: { value: partial } });
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("assumes the year being worked on when none is typed", () => {
    const { onChange, input } = show({ assumeYear: 2027 });
    fireEvent.change(input, { target: { value: "11/3" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(on(2027, 11, 3));
  });
});

describe("when it cannot read what was typed", () => {
  it("says so", () => {
    const { input } = show();
    fireEvent.change(input, { target: { value: "banana" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("date-error")).toBeDefined();
  });

  it("leaves the text on screen rather than wiping it", () => {
    const { input } = show();
    fireEvent.change(input, { target: { value: "banana" } });
    fireEvent.blur(input);
    expect(input.value).toBe("banana");
  });

  it("reports nothing upwards", () => {
    const { onChange, input } = show({ value: on(2026, 11, 3) });
    fireEvent.change(input, { target: { value: "banana" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the complaint as soon as typing resumes", () => {
    const { input } = show();
    fireEvent.change(input, { target: { value: "banana" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("date-error")).toBeDefined();
    fireEvent.change(input, { target: { value: "b" } });
    expect(screen.queryByTestId("date-error")).toBeNull();
  });

  it("refuses a date that does not exist, rather than sliding it forward", () => {
    // 2/31 becomes the 3rd of March if anyone lets JavaScript decide.
    const { onChange, input } = show();
    fireEvent.change(input, { target: { value: "2/31/2026" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("date-error")).toBeDefined();
  });

  it("Escape puts the shown date back", () => {
    const { input } = show({ value: on(2026, 11, 3) });
    fireEvent.change(input, { target: { value: "rubbish" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("Nov 3, 2026");
  });
});

describe("emptying the box", () => {
  it("clears the date on an optional field", () => {
    const { onChange, input } = show({ value: on(2026, 11, 3) });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("leaves a required field alone", () => {
    // hideClear is how the form says "this one is required". Blanking it by
    // accident should not silently remove the event's date.
    const { onChange, input } = show({ value: on(2026, 11, 3), hideClear: true });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers a clear button only when the field is optional", () => {
    show({ value: on(2026, 11, 3) });
    expect(screen.getByLabelText("Clear date")).toBeDefined();
  });

  it("hides the clear button on a required field", () => {
    show({ value: on(2026, 11, 3), hideClear: true });
    expect(screen.queryByLabelText("Clear date")).toBeNull();
  });
});
