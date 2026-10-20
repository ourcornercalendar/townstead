"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import Image from "next/image";
import { Search, CalendarDays, MapPin, Clock, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EventCalendar } from "@/components/public/event-calendar";
import { useCommunityFilter } from "@/hooks/use-community-filter";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { expandEventOccurrences } from "@/lib/events/recurrence";

export default function EventsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const { communityId, buildHref } = useCommunityFilter(orgSlug);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    Id<"categories"> | undefined
  >(undefined);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const monthStart = startOfMonth(calendarMonth).getTime();
  const monthEnd = endOfMonth(calendarMonth).getTime();

  const events = useQuery(api.public.queries.listEvents, {
    orgSlug,
    startDate: monthStart,
    endDate: monthEnd,
    categoryId: selectedCategory,
    communityId,
  });

  const categories = useQuery(api.public.queries.listCategories, {
    orgSlug,
    type: "event",
  });

  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c.name])),
    [categories]
  );

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    let result = events.filter((e) =>
      expandEventOccurrences(e, calendarMonth.getFullYear()).some(
        (occurrence) =>
          occurrence.date >= monthStart && occurrence.date <= monthEnd
      )
    );

    if (selectedDate) {
      result = result.filter((e) =>
        expandEventOccurrences(e, selectedDate.getFullYear()).some(
          (occurrence) => isSameDay(new Date(occurrence.date), selectedDate)
        )
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // Includes the category, so typing "school district" finds everything
      // filed under it without first hunting for the right button.
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          (e.categoryId
            ? (categoryNames.get(e.categoryId) ?? "").toLowerCase().includes(q)
            : false),
      );
    }

    return result;
  }, [
    calendarMonth,
    events,
    monthEnd,
    monthStart,
    selectedDate,
    searchQuery,
    categoryNames,
  ]);

  const calendarEvents = useMemo(
    () =>
      (events ?? []).map((e) => ({
        _id: e._id,
        name: e.name,
        date: e.date,
        endDate: e.endDate,
        isYearly: e.isYearly,
        scheduleType: e.scheduleType,
        startsOn: e.startsOn,
        endsOn: e.endsOn,
        monthlyOrdinal: e.monthlyOrdinal,
        monthlyWeekday: e.monthlyWeekday,
        monthlyMonthSelector: e.monthlyMonthSelector,
      })),
    [events],
  );

  function handleDateClick(date: Date) {
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  }

  function handleMonthChange(date: Date) {
    setCalendarMonth(date);
    setSelectedDate(null);
  }

  if (!events || !categories) return <EventsPageSkeleton />;

  return (
    <div className="font-body mx-auto w-full max-w-7xl px-4 py-12 text-on-surface md:px-6 md:py-24">
      <div className="mb-12 md:mb-24">
        <h1 className="font-headline text-3xl italic tracking-tight text-on-surface md:text-4xl">
          Events
        </h1>
        <p className="mt-2 text-on-surface/70">
          Discover what&apos;s happening in your community
        </p>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
        {/* Sidebar: search + categories (desktop), top bar (mobile) */}
        <aside className="w-full shrink-0 space-y-6 lg:w-64">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface/60" />
            <input
              type="text"
              placeholder="Search by name, place or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border-0 bg-surface-container-low pl-9 pr-3 text-sm text-on-surface outline-none ring-0 transition-colors placeholder:text-on-surface/50 focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Category filters */}
          {categories.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Filter className="size-3" />
                Categories
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={
                    !selectedCategory
                      ? "inline-flex h-6 shrink-0 items-center justify-center rounded-[min(var(--radius-md),10px)] border-0 bg-secondary px-2 text-xs font-bold text-secondary-foreground transition-colors hover:bg-secondary/90"
                      : "inline-flex h-6 shrink-0 items-center justify-center rounded-[min(var(--radius-md),10px)] border-0 bg-surface-container-low px-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container"
                  }
                  onClick={() => setSelectedCategory(undefined)}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    className={
                      selectedCategory === cat._id
                        ? "inline-flex h-6 shrink-0 items-center justify-center rounded-[min(var(--radius-md),10px)] border-0 bg-secondary px-2 text-xs font-bold text-secondary-foreground transition-colors hover:bg-secondary/90"
                        : "inline-flex h-6 shrink-0 items-center justify-center rounded-[min(var(--radius-md),10px)] border-0 bg-surface-container-low px-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container"
                    }
                    onClick={() =>
                      setSelectedCategory(
                        selectedCategory === cat._id ? undefined : cat._id,
                      )
                    }
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-24">
          {/* Mobile date picker */}
          <div className="md:hidden">
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-primary">
              Filter by Date
            </label>
            <input
              type="date"
              value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value + "T00:00:00"));
                } else {
                  setSelectedDate(null);
                }
              }}
              className="h-10 w-full rounded-lg border-0 bg-surface-container-low px-3 text-sm text-on-surface outline-none ring-0 transition-colors focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Calendar grid (desktop only) */}
          <div className="hidden md:block">
            <EventCalendar
              events={calendarEvents}
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
              onMonthChange={handleMonthChange}
            />
          </div>

          {/* Selected date indicator */}
          {selectedDate && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-surface-container-high px-3 py-2 text-sm font-bold text-primary">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </div>
              <button
                type="button"
                className="inline-flex h-6 items-center justify-center rounded-[min(var(--radius-md),10px)] px-2 text-xs font-bold text-primary transition-colors hover:bg-surface-container hover:text-primary"
                onClick={() => setSelectedDate(null)}
              >
                Clear
              </button>
            </div>
          )}

          {/* Events list */}
          <div>
            <p className="mb-4 text-sm text-on-surface/70">
              {filteredEvents.length}{" "}
              {filteredEvents.length === 1 ? "event" : "events"}
              {selectedDate && " on this day"}
            </p>

            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg bg-surface-container-low py-16 text-center">
                <CalendarDays className="mb-4 size-10 text-on-surface/40" />
                <p className="font-body font-medium text-on-surface">
                  No events found
                </p>
                <p className="mt-2 text-sm text-on-surface/70">
                  Try adjusting your filters or selecting a different date
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event) => (
                  <Link
                    key={event._id}
                    href={buildHref(`events/${event._id}`)}
                  >
                    <div className="editorial-shadow rounded-lg bg-surface-container-lowest p-6 transition-colors hover:bg-surface-container">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-4 min-w-0">
                          {event.imageUrl && (
                            <Image
                              src={event.imageUrl}
                              alt=""
                              width={80}
                              height={80}
                              className="shrink-0 rounded-md object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-headline line-clamp-1 text-xl italic text-on-surface">
                              {event.name}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface/70">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3.5 shrink-0" />
                                {format(
                                  new Date(event.date),
                                  "EEE, MMM d · h:mm a",
                                )}
                              </span>
                              {event.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3.5 shrink-0" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg bg-surface-container-high px-3 py-2 text-center">
                          <span className="block text-xs font-bold text-primary">
                            {format(new Date(event.date), "MMM")}
                          </span>
                          <span className="block text-lg font-bold leading-tight text-primary">
                            {format(new Date(event.date), "d")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function EventsPageSkeleton() {
  return (
    <div className="font-body mx-auto w-full max-w-7xl px-4 py-12 text-on-surface md:px-6 md:py-24">
      <Skeleton className="mb-2 h-9 w-40 rounded-lg bg-surface-container-high" />
      <Skeleton className="mb-12 h-5 w-72 rounded-lg bg-surface-container-high" />
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 space-y-4 lg:w-64">
          <Skeleton className="h-10 w-full rounded-lg bg-surface-container-high" />
          <Skeleton className="h-24 w-full rounded-lg bg-surface-container-high" />
        </div>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-72 rounded-lg bg-surface-container-high" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg bg-surface-container-high" />
          ))}
        </div>
      </div>
    </div>
  );
}
