"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useOrg } from "@/hooks/use-org";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { CalendarDays, Download } from "lucide-react";
import { buildEventExportMonthGroups } from "@/lib/events-export";
import { useDefaultYear } from "@/hooks/use-default-year";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Falls back to the current year only when a typed year is unreadable;
// the value the field opens on is the calendar being sold, below.
const currentYear = new Date().getFullYear();

function clampYear(n: number): number {
  if (!Number.isFinite(n)) return currentYear;
  return Math.min(2100, Math.max(2000, Math.round(n)));
}

export default function EventsExportPage() {
  const { orgId, isReady } = useOrg();
  const { defaultYear } = useDefaultYear();
  const [yearInput, setYearInput] = useState(String(defaultYear));
  const [editionSelect, setEditionSelect] = useState<string>("all");

  const events = useQuery(
    api.events.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );
  const calendarEditions = useQuery(
    api.calendarEditions.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );

  const year = clampYear(parseInt(yearInput, 10));

  const calendarEditionId: Id<"calendarEditions"> | null =
    editionSelect !== "all"
      ? (editionSelect as Id<"calendarEditions">)
      : null;

  const monthGroups = useMemo(() => {
    if (!events) return null;
    return buildEventExportMonthGroups(events, year, calendarEditionId);
  }, [events, year, calendarEditionId]);

  const handleDownloadList = () => {
    const params = new URLSearchParams({ year: String(year) });
    // The list-style PDF originally accepted communityId. Until a calendar-
    // edition variant is wired, just download the year roll-up.
    window.open(`/api/pdf/events-export?${params}`, "_blank");
  };

  const handleDownloadCalendar = () => {
    const params = new URLSearchParams({ year: String(year) });
    if (calendarEditionId) params.set("calendarEditionId", calendarEditionId);
    window.open(`/api/pdf/calendar?${params}`, "_blank");
  };

  if (!isReady || events === undefined || calendarEditions === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader title="Export event calendar" />
        <TableSkeleton columns={4} rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Export event calendar"
        description="Preview events by month, then download a calendar grid PDF or a list-style summary."
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleDownloadList}>
              <Download className="mr-2 h-4 w-4" />
              List PDF
            </Button>
            <Button type="button" onClick={handleDownloadCalendar}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Calendar PDF
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-2">
          <Label htmlFor="export-year">Event Year</Label>
          <Input
            id="export-year"
            type="number"
            min={2000}
            max={2100}
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            onBlur={() => setYearInput(String(clampYear(parseInt(yearInput, 10))))}
            className="w-32"
          />
        </div>
        <div className="space-y-2">
          <Label>Calendar Edition</Label>
          <Select
            value={editionSelect}
            onValueChange={(v) => setEditionSelect(v ?? "all")}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All editions">
                {editionSelect === "all"
                  ? "All editions"
                  : (calendarEditions.find((c) => c._id === editionSelect)
                      ?.name ?? "All editions")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All editions</SelectItem>
              {calendarEditions.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {monthGroups?.map((group) => (
          <Card key={group.monthIndex} size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-base">
                {MONTHS[group.monthIndex]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {group.items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No events</p>
              ) : (
                group.items.map((item, idx) => (
                  <div
                    key={`${group.monthIndex}-${idx}-${item.name}`}
                    className="space-y-1 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <p className="font-medium leading-snug">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.dateStr}
                    </p>
                    <p className="text-muted-foreground text-xs">{item.times}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
