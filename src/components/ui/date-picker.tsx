"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { parseTypedDate } from "@/lib/events/parse-date";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  /** Unix milliseconds at local midnight, or undefined for empty. */
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  /** Disable dates before this Date (inclusive comparison done by day). */
  fromDate?: Date;
  /** Disable dates after this Date (inclusive comparison done by day). */
  toDate?: Date;
  /** Hide the inline clear button (e.g. when the field is required). */
  hideClear?: boolean;
  className?: string;
  buttonClassName?: string;
  id?: string;
  ariaLabel?: string;
  /** Optional render-format for the trigger label. Defaults to MMM d, yyyy. */
  displayFormat?: string;
  /**
   * The year to assume when somebody types a date with no year, like "11/3".
   * Pass the year being worked on, so typing a bare date while arranging the
   * 2027 calendar means 2027 and not whatever year it is today.
   */
  assumeYear?: number;
}

/** Build a local-midnight Date from a Unix ms timestamp. */
function fromTimestamp(ts: number | undefined): Date | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Coerce a react-day-picker Date selection to a local-midnight Unix ms. */
function toTimestamp(date: Date | undefined): number | undefined {
  if (!date) return undefined;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  fromDate,
  toDate,
  hideClear = false,
  className,
  buttonClassName,
  id,
  ariaLabel,
  displayFormat = "MMM d, yyyy",
  assumeYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = fromTimestamp(value);

  // What is in the box while it is being typed in. Separate from `value`
  // because half-finished text ("11/") is not a date and must not be
  // reported upwards as one — but it does have to stay on screen while the
  // rest of it is typed.
  const [draft, setDraft] = React.useState<string | null>(null);
  const [bad, setBad] = React.useState(false);

  const shown = draft ?? (selected ? format(selected, displayFormat) : "");

  const handleSelect = (date: Date | undefined) => {
    setDraft(null);
    setBad(false);
    onChange(toTimestamp(date));
    if (date) setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraft(null);
    setBad(false);
    onChange(undefined);
  };

  /**
   * Take what was typed, when the box is left or Enter is pressed.
   *
   * Not on every keystroke: "11/3/2026" passes through "1", which is not a
   * date, and through "11/3/2", which is the year 2002. Reading it as it is
   * typed would send the calendar jumping around and could leave a wrong
   * year behind if the field were left mid-word.
   */
  const commitTyped = () => {
    if (draft === null) return;
    const text = draft.trim();
    if (text === "") {
      setDraft(null);
      setBad(false);
      // An empty box means no date — unless the field is required, in which
      // case whatever was there stays.
      if (!hideClear) onChange(undefined);
      return;
    }
    const parsed = parseTypedDate(
      text,
      assumeYear ?? selected?.getFullYear() ?? new Date().getFullYear()
    );
    if (parsed === null) {
      // Left on screen and marked, rather than wiped. Wiping what somebody
      // typed because it was not understood is how you lose a date they
      // then have to remember.
      setBad(true);
      return;
    }
    setBad(false);
    setDraft(null);
    onChange(parsed);
  };

  return (
    <div className={cn("relative", className)}>
      {/* A box you can type into, with the calendar still one click away.
          It used to be the button alone, so picking a date nine months out
          meant clicking forward nine times. Typing it is three seconds. */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            id={id}
            value={shown}
            placeholder={placeholder}
            aria-label={ariaLabel ?? placeholder}
            aria-invalid={bad || undefined}
            data-testid="date-input"
            autoComplete="off"
            className={cn(
              !hideClear && (selected || draft) && "pr-8",
              bad && "border-destructive focus-visible:ring-destructive/40",
              buttonClassName
            )}
            onChange={(e) => {
              setDraft(e.target.value);
              if (bad) setBad(false);
            }}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTyped();
              }
              if (e.key === "Escape") {
                setDraft(null);
                setBad(false);
              }
            }}
          />
          {!hideClear && (selected || draft) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:opacity-100"
              aria-label="Clear date"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                aria-label="Open calendar"
                variant="outline"
                size="icon"
                className="shrink-0"
              />
            }
          >
            <CalendarIcon className="size-4 opacity-70" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? new Date()}
            disabled={
              fromDate || toDate
                ? (date) => {
                    if (fromDate && date < fromDate) return true;
                    if (toDate && date > toDate) return true;
                    return false;
                  }
                : undefined
            }
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {bad && (
        <p
          data-testid="date-error"
          role="alert"
          className="mt-1 text-xs text-destructive"
        >
          Not a date I understand. Try 11/3/2027, Nov 3 2027, or use the
          calendar button.
        </p>
      )}
    </div>
  );
}
