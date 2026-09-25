"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useAuth, SignOutButton } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { EventForm } from "@/app/admin/events/event-form";
import { DownloadEventsButton } from "@/app/admin/events/download-events-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Trash2, Search, ShieldAlert } from "lucide-react";

/**
 * The events desk.
 *
 * Deliberately not part of `/admin`. Someone invited to help with the calendar
 * is not a member of the Clerk organisation, which is what keeps contacts,
 * purchases and billing closed to them at the server rather than merely hidden
 * from their screen. Putting them inside the admin shell would have meant
 * loosening that, so instead this is one page that reaches only the events
 * tables -- using Joyce's own event form, so a printed event gets its edition,
 * its placement in the square and its red-ink flag like any other.
 */

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function EventDeskPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const workspace = useQuery(
    api.teamInvites.queries.myWorkspace,
    isLoaded && isSignedIn ? {} : "skip"
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/auth/login");
  }, [isLoaded, isSignedIn, router]);

  const orgId = workspace?.orgId;

  const events = useQuery(
    api.events.queries.list,
    orgId ? { orgId } : "skip"
  );
  const calendarEditions = useQuery(
    api.calendarEditions.queries.list,
    orgId ? { orgId } : "skip"
  );
  const softDelete = useMutation(api.events.mutations.softDelete);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"events"> | null>(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<Doc<"events"> | null>(null);

  const visible = useMemo(() => {
    if (!events) return [];
    const term = search.trim().toLowerCase();
    const matched = term
      ? events.filter(
          (e) =>
            e.name.toLowerCase().includes(term) ||
            (e.location ?? "").toLowerCase().includes(term)
        )
      : events;
    return [...matched].sort((a, b) => a.date - b.date);
  }, [events, search]);

  if (!isLoaded || workspace === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Not a helper: either an administrator who belongs in /admin, or somebody
  // whose access has been turned off. Saying which is not this page's job.
  if (workspace === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">
          Nothing here for this account
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page is for someone who has been given access to the calendar. If
          you run the calendar yourself, use the admin area instead.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin")}>
            Go to admin
          </Button>
          <SignOutButton redirectUrl="/">
            <Button>Sign out</Button>
          </SignOutButton>
        </div>
      </div>
    );
  }

  // Without `events:manage_all`, only what this person put in themselves. The
  // list query already filters to that, so this is belt as well as braces --
  // but a button that appears and then fails is worse than no button.
  const mine = (event: Doc<"events">) => event.submittedBy === userId;
  const canEdit = (event: Doc<"events">) =>
    workspace.canManageAll || (workspace.canEditOwn && mine(event));
  const canDelete = (event: Doc<"events">) =>
    workspace.canManageAll || (workspace.canDeleteOwn && mine(event));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            {workspace.name ? `${workspace.name} — ` : ""}
            {workspace.orgName}
            {workspace.publishesImmediately
              ? " · what you add goes on the calendar straight away"
              : " · what you add waits for approval"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            Add event
          </Button>
          {/*
            The same download the administrator has: a year of the calendar as
            a printable PDF, a month to a page, for sending to whoever sets the
            printed edition.
          */}
          <DownloadEventsButton calendarEditions={calendarEditions ?? []} />
          <SignOutButton redirectUrl="/">
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or place"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {events === undefined ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {search
                    ? "Nothing matches that."
                    : "No events yet. Add the first one."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((event) => (
                <TableRow key={event._id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell>{formatDate(event.date)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.location ?? "—"}
                  </TableCell>
                  <TableCell>
                    {event.isApproved === false ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300">
                        Waiting for approval
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-500/20 dark:text-green-300">
                        On the calendar
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canEdit(event) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${event.name}`}
                          onClick={() => {
                            setEditing(event);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete(event) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${event.name}`}
                          onClick={() => setDeleting(event)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {orgId && (
        <EventForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          calendarEditions={calendarEditions ?? []}
          orgId={orgId}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.name}&rdquo; will come off the calendar. Ask
              whoever runs the calendar if you need it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await softDelete({ id: deleting._id });
                  toast.success("Event deleted");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Couldn't delete it"
                  );
                } finally {
                  setDeleting(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
