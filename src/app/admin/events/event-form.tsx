"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { eventSchema, type EventFormValues } from "@/lib/validators";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { CircleHelp } from "lucide-react";
import {
  EVENT_MONTH_SELECTOR_OPTIONS,
  EVENT_ORDINAL_OPTIONS,
  EVENT_SCHEDULE_TYPES,
  EVENT_WEEKDAY_OPTIONS,
  type EventScheduleType,
} from "@/lib/events/recurrence";

/** The three bands a printed calendar square is divided into. */
const PRINT_PLACEMENTS = [
  { value: "TOP", label: "Top" },
  { value: "MIDDLE", label: "Middle" },
  { value: "BOTTOM", label: "Bottom" },
] as const;

const SCHEDULE_HELP = [
  {
    title: "Single-Day Event",
    description:
      "Use this for an event that begins and ends on one date. It can be one-time or yearly.",
    example: "Example: July 4, 2026, or a birthday every July 4.",
    accent: "bg-emerald-50 border-emerald-200",
    icon: "bg-emerald-500 text-white",
    tag: "One date",
  },
  {
    title: "Every day between start and end",
    description:
      "Use this for an event that appears on every date between the start date and end date.",
    example: "Example: A festival from May 10 through May 12.",
    accent: "bg-sky-50 border-sky-200",
    icon: "bg-sky-500 text-white",
    tag: "Every day",
  },
  {
    title: "On selected day(s) of each month",
    description:
      "Use this for day-of-month positions: every, every other, second/fourth, first/third/fifth, first, second, third, fourth, or last.",
    example: "Example: the first day of each month, or the second and fourth day of each month.",
    accent: "bg-amber-50 border-amber-200",
    icon: "bg-amber-500 text-white",
    tag: "Monthly",
  },
  {
    title: "On selected weekday of selected months",
    description:
      "Use this for ordinal weekdays in every, even, or odd months.",
    example: "Example: the second and fourth Monday of every month, or the first Friday of odd months.",
    accent: "bg-fuchsia-50 border-fuchsia-200",
    icon: "bg-fuchsia-500 text-white",
    tag: "Pattern",
  },
];

const SCHEDULE_DESCRIPTIONS: Record<EventScheduleType, string> = {
  SINGLE_DAY:
    "One date only. Turn on Recurring Yearly if it should repeat on the same month/day every year.",
  DAILY_RANGE:
    "Repeats every day between the selected start and end dates, inclusive.",
  MONTHLY_DAY:
    "Repeats on selected day-of-month positions between the start and end dates.",
  MONTHLY_ORDINAL_WEEKDAY:
    "Repeats on selected weekday positions for every, even, or odd months between the start and end dates.",
};

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Doc<"events"> | null;
  calendarEditions: Doc<"calendarEditions">[];
}

export function EventForm({
  open,
  onOpenChange,
  editing,
  calendarEditions,
}: EventFormProps) {
  const { orgId } = useOrg();
  const create = useMutation(api.events.mutations.create);
  const update = useMutation(api.events.mutations.update);
  const generateUploadUrl = useMutation(api.events.mutations.generateUploadUrl);
  const [isPending, setIsPending] = useState(false);
  const [imageFileId, setImageFileId] = useState<Id<"_storage"> | undefined>();
  const [uploadingImage, setUploadingImage] = useState(false);

  const existingImageUrl = useQuery(
    api.storage.getUrl,
    imageFileId ? { storageId: imageFileId } : "skip"
  );

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: "",
      description: "",
      date: Date.now(),
      endDate: undefined,
      scheduleType: "SINGLE_DAY",
      startsOn: Date.now(),
      endsOn: undefined,
      monthlyOrdinal: "FIRST",
      monthlyWeekday: "MONDAY",
      monthlyMonthSelector: "EVERY",
      printPlacement: "TOP",
      isScusd: false,
      isYearly: false,
      calendarEditionIds: [],
    },
  });

  const scheduleType = form.watch("scheduleType") ?? "SINGLE_DAY";
  const requiresEndDate = scheduleType !== "SINGLE_DAY";
  const isMonthlySchedule =
    scheduleType === "MONTHLY_DAY" ||
    scheduleType === "MONTHLY_ORDINAL_WEEKDAY";

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        description: editing.description ?? "",
        date: editing.date,
        endDate: editing.endDate,
        scheduleType: editing.scheduleType ?? "SINGLE_DAY",
        startsOn: editing.startsOn ?? editing.date,
        endsOn: editing.endsOn ?? editing.endDate,
        monthlyOrdinal: editing.monthlyOrdinal ?? "FIRST",
        monthlyWeekday: editing.monthlyWeekday ?? "MONDAY",
        monthlyMonthSelector: editing.monthlyMonthSelector ?? "EVERY",
        printPlacement: editing.printPlacement ?? "TOP",
        isScusd: editing.isScusd ?? false,
        isYearly: editing.isYearly ?? false,
        calendarEditionIds: (editing.calendarEditionIds as string[]) ?? [],
      });
      setImageFileId(editing.imageFileId ?? undefined);
    } else {
      form.reset({
        name: "",
        description: "",
        date: Date.now(),
        endDate: undefined,
        scheduleType: "SINGLE_DAY",
        startsOn: Date.now(),
        endsOn: undefined,
        monthlyOrdinal: "FIRST",
        monthlyWeekday: "MONDAY",
        monthlyMonthSelector: "EVERY",
        printPlacement: "TOP",
        isScusd: false,
        isYearly: false,
        calendarEditionIds: [],
      });
      setImageFileId(undefined);
    }
  }, [editing, form]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      setUploadingImage(true);
      try {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        setImageFileId(storageId as Id<"_storage">);
      } catch {
        toast.error("Failed to upload image");
      } finally {
        setUploadingImage(false);
      }
    },
    [generateUploadUrl]
  );

  const onSubmit = async (values: EventFormValues) => {
    if (!orgId) return;
    setIsPending(true);
    try {
      const payload = {
        scheduleType: values.scheduleType ?? "SINGLE_DAY",
        startsOn: values.startsOn ?? values.date,
        endsOn:
          values.scheduleType && values.scheduleType !== "SINGLE_DAY"
            ? values.endsOn ?? values.endDate
            : undefined,
        monthlyOrdinal: isMonthlySchedule
          ? values.monthlyOrdinal ?? "FIRST"
          : undefined,
        monthlyWeekday:
          values.scheduleType === "MONTHLY_ORDINAL_WEEKDAY"
            ? values.monthlyWeekday
            : undefined,
        monthlyMonthSelector:
          values.scheduleType === "MONTHLY_ORDINAL_WEEKDAY"
            ? values.monthlyMonthSelector ?? "EVERY"
            : undefined,
        name: values.name,
        description: values.description || undefined,
        date: values.startsOn ?? values.date,
        endDate:
          values.scheduleType === "DAILY_RANGE"
            ? values.endsOn ?? values.endDate
            : undefined,
        printPlacement: values.printPlacement ?? "TOP",
        isScusd: values.isScusd ?? false,
        isYearly:
          values.scheduleType === "MONTHLY_DAY" ||
          values.scheduleType === "MONTHLY_ORDINAL_WEEKDAY"
            ? true
            : values.isYearly || undefined,
        calendarEditionIds:
          values.calendarEditionIds && values.calendarEditionIds.length > 0
            ? (values.calendarEditionIds as Id<"calendarEditions">[])
            : undefined,
        imageFileId,
      };

      if (editing) {
        await update({ id: editing._id, ...payload });
      } else {
        await create({ orgId, ...payload });
      }
      toast.success("Event saved");
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error("Failed to save event");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-2xl overflow-y-auto border-l-4 border-l-emerald-500 bg-gradient-to-br from-background via-background to-emerald-50/40 p-0 dark:to-emerald-950/20"
      >
        <SheetHeader className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5 text-white shadow-sm">
          <SheetTitle className="text-xl font-semibold tracking-tight text-white">
            {editing ? "Edit" : "New"} Event
          </SheetTitle>
          <p className="mt-1 text-sm text-white/80">
            Plan a one-off date or a repeating pattern that rolls across the
            calendar year.
          </p>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6 px-6 pb-6 pt-4"
          >
            <div className="space-y-4 rounded-lg border bg-card/80 p-5 shadow-sm">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Event name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Event description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Event image upload temporarily hidden — re-enable when ready.
              <div className="space-y-1">
                <Label>Event Image</Label>
                <ImageUpload
                  preset="event"
                  onUpload={handleImageUpload}
                  onRemove={() => setImageFileId(undefined)}
                  currentImageUrl={existingImageUrl ?? null}
                  uploading={uploadingImage}
                />
              </div>
              */}
              <FormField
                control={form.control}
                name="scheduleType"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel>Schedule</FormLabel>
                      <Dialog>
                        <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" />}>
                          <CircleHelp className="size-4" />
                          <span className="sr-only">Open schedule help</span>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl overflow-hidden p-0">
                          <DialogHeader className="bg-gradient-to-r from-cyan-600 via-blue-600 to-fuchsia-600 px-6 py-5 text-white">
                            <DialogTitle className="text-white">
                              Schedule Types
                            </DialogTitle>
                            <DialogDescription className="text-white/85">
                              Choose the pattern that matches how the event
                              should appear on calendars and exports.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 p-6 sm:grid-cols-2">
                            {SCHEDULE_HELP.map((item) => (
                              <div
                                key={item.title}
                                className={`rounded-lg border p-4 shadow-sm ${item.accent}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-bold ${item.icon}`}
                                  >
                                    {item.title.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-sm font-semibold text-slate-950">
                                        {item.title}
                                      </h3>
                                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-700">
                                        {item.tag}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm leading-5 text-slate-700">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-3 rounded-md bg-white/75 px-3 py-2 text-sm text-slate-800">
                                  {item.example}
                                </p>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <FormControl>
                      <Select
                        value={field.value ?? "SINGLE_DAY"}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {EVENT_SCHEDULE_TYPES.find(
                              (option) => option.value === field.value
                            )?.label ?? "Single-Day Event"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_SCHEDULE_TYPES.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      {SCHEDULE_DESCRIPTIONS[field.value ?? "SINGLE_DAY"]}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div
                className={
                  requiresEndDate
                    ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                    : "grid grid-cols-1 gap-4"
                }
              >
                <FormField
                  control={form.control}
                  name="startsOn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {requiresEndDate ? "Start Date" : "Date"}
                      </FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick a date"
                          buttonClassName="w-full"
                          toDate={
                            requiresEndDate && form.getValues("endsOn")
                              ? new Date(form.getValues("endsOn") as number)
                              : undefined
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {scheduleType === "SINGLE_DAY"
                          ? "The event date. For yearly events, only the month and day are reused."
                          : "The first date this repeating pattern can appear."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {requiresEndDate && (
                  <FormField
                    control={form.control}
                    name="endsOn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Pick an end date"
                            buttonClassName="w-full"
                            fromDate={
                              form.getValues("startsOn")
                                ? new Date(form.getValues("startsOn") as number)
                                : undefined
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          The final date this repeating pattern can appear.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              {isMonthlySchedule && (
                <FormField
                  control={form.control}
                  name="monthlyOrdinal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repeat On</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? "FIRST"}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {EVENT_ORDINAL_OPTIONS.find(
                                (option) => option.value === field.value
                              )?.label ?? "first"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_ORDINAL_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        For monthly day schedules, this means day-of-month
                        positions. For monthly weekday schedules, this means
                        weekday occurrence positions.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {scheduleType === "MONTHLY_ORDINAL_WEEKDAY" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyWeekday"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weekday</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? "MONDAY"}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {EVENT_WEEKDAY_OPTIONS.find(
                                  (option) => option.value === field.value
                                )?.label ?? "Monday"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {EVENT_WEEKDAY_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="monthlyMonthSelector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Months</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? "EVERY"}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {EVENT_MONTH_SELECTOR_OPTIONS.find(
                                  (option) => option.value === field.value
                                )?.label ?? "every"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {EVENT_MONTH_SELECTOR_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {/*
                Where this event sits in the printed calendar square, and
                whether it prints red.

                The Start Time and End Time fields used to be here. They came
                out because they were never printed and were cluttering the
                form Joyce fills in for every date. Times a member of the
                public submits with their own event are untouched, and still
                show on the website.
              */}
              <div className="rounded-md border p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">On the printed calendar</p>
                  <p className="text-sm text-muted-foreground">
                    The name prints in bold, the description underneath it in
                    regular.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="printPlacement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Where in the square</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {PRINT_PLACEMENTS.map((option) => {
                            const active = (field.value ?? "TOP") === option.value;
                            return (
                              <Button
                                key={option.value}
                                type="button"
                                variant={active ? "default" : "outline"}
                                size="sm"
                                aria-pressed={active}
                                onClick={() => field.onChange(option.value)}
                              >
                                {option.label}
                              </Button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Two events set to the same spot print one under the
                        other, in the order they were added.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isScusd"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          id="isScusd"
                          checked={field.value ?? false}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <div>
                        <FormLabel htmlFor="isScusd">
                          School district date — print in red
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          The name and the description both print red, so
                          families can pick school dates out of a full square.
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {scheduleType === "SINGLE_DAY" && (
                <FormField
                  control={form.control}
                  name="isYearly"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="mt-0!">Recurring Yearly</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {calendarEditions.length > 0 && (
              <div className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/50 p-5 shadow-sm dark:border-teal-900/40 dark:bg-teal-950/20">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-teal-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100">
                    Calendar Editions
                  </h3>
                </div>
                <FormField
                  control={form.control}
                  name="calendarEditionIds"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {calendarEditions.map((edition) => {
                            const checked = (field.value ?? []).includes(
                              edition._id
                            );
                            return (
                              <div
                                key={edition._id}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  id={`edition-${edition._id}`}
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    const current = field.value ?? [];
                                    if (val) {
                                      field.onChange([...current, edition._id]);
                                    } else {
                                      field.onChange(
                                        current.filter(
                                          (id: string) => id !== edition._id
                                        )
                                      );
                                    }
                                  }}
                                />
                                <Label
                                htmlFor={`edition-${edition._id}`}
                                className="cursor-pointer text-sm font-medium"
                              >
                                {edition.name}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                      <FormDescription>
                        Select one or more calendar editions where this event should appear.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <SheetFooter className="border-t border-border/60 bg-background/80 px-0 pt-4">
              <Button
                type="submit"
                disabled={isPending}
                size="lg"
                className="w-full bg-emerald-600 font-semibold hover:bg-emerald-700"
              >
                {isPending ? "Saving..." : "Save Event"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
