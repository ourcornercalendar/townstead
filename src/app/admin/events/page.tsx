"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, List, CalendarDays } from "lucide-react";
import { useState, useMemo } from "react";
import { columns } from "./columns";
import { EventForm } from "./event-form";
import { EventCalendar } from "./event-calendar";
import { DownloadEventsButton } from "./download-events-button";
import type { Doc } from "../../../../convex/_generated/dataModel";

export default function EventsPage() {
  const { orgId, isReady } = useOrg();
  const events = useQuery(
    api.events.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );
  const calendarEditions = useQuery(
    api.calendarEditions.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );
  const categories = useQuery(
    api.categories.queries.list,
    isReady ? { orgId: orgId!, type: "event" as const } : "skip"
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"events"> | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending">("all");

  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c.name])),
    [categories]
  );

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (statusFilter === "all") return events;
    if (statusFilter === "pending") return events.filter((e) => e.isApproved === false);
    return events.filter((e) => e.isApproved !== false);
  }, [events, statusFilter]);

  if (!isReady || events === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader title="Events" />
        <TableSkeleton columns={5} rows={10} />
      </div>
    );
  }

  const handleEdit = (event: Doc<"events">) => {
    setEditing(event);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Manage calendar events and holidays"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | "approved" | "pending")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue>
                  {{ all: "All Statuses", approved: "Approved", pending: "Pending" }[
                    statusFilter
                  ] ?? "All Statuses"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="rounded-l-none"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </div>
            <DownloadEventsButton
              calendarEditions={calendarEditions ?? []}
            />
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        }
      />
      {viewMode === "list" ? (
        <DataTable
          columns={columns({
            onEdit: handleEdit,
            calendarEditions: calendarEditions ?? [],
            categories: categories ?? [],
          })}
          data={filteredEvents}
          // Was searchKey="name", which only ever looked at the name. An
          // event is as likely to be remembered by where it is or what it is
          // filed under, so the box now matches any of them.
          searchText={(e) =>
            [
              e.name,
              e.description,
              e.location,
              e.categoryId ? categoryNames.get(e.categoryId) : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
          searchPlaceholder="Search events by name, category or place..."
          emptyTitle="No events"
          emptyDescription="Get started by adding your first event."
        />
      ) : (
        <EventCalendar events={events} onEventClick={handleEdit} />
      )}
      <EventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        calendarEditions={calendarEditions ?? []}
      />
    </div>
  );
}
