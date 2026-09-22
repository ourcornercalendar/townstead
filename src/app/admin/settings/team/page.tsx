"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PERMISSIONS } from "../../../../../convex/permissions";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Mail,
  Clock,
  X,
  Trash2,
} from "lucide-react";

/**
 * Adding a helper.
 *
 * Deliberately not the same thing as inviting someone to the Clerk
 * organisation: an organisation member is an administrator and sees the whole
 * business. Someone added here is never made a member, so every admin
 * function refuses them at the server, not merely at the screen.
 */

type EventLevel = "create" | "submit";

const OPTIONAL_EXTRAS = [
  {
    id: PERMISSIONS.EVENTS_UPDATE_OWN,
    label: "Edit events they added",
  },
  {
    id: PERMISSIONS.EVENTS_DELETE_OWN,
    label: "Delete events they added",
  },
] as const;

function permissionsFor(level: EventLevel, extras: string[]): string[] {
  const base =
    level === "create" ? PERMISSIONS.EVENTS_CREATE : PERMISSIONS.EVENTS_SUBMIT;
  return [base, ...extras];
}

function describe(permissions: string[]): string {
  const parts: string[] = [];
  if (permissions.includes(PERMISSIONS.EVENTS_CREATE)) {
    parts.push("Adds events — published immediately");
  } else if (permissions.includes(PERMISSIONS.EVENTS_SUBMIT)) {
    parts.push("Adds events — you approve them first");
  }
  if (permissions.includes(PERMISSIONS.EVENTS_UPDATE_OWN)) {
    parts.push("edits their own");
  }
  if (permissions.includes(PERMISSIONS.EVENTS_DELETE_OWN)) {
    parts.push("deletes their own");
  }
  return parts.join(", ") || "No access";
}

export default function TeamPage() {
  const members = useQuery(api.teamInvites.queries.listMembers, {});
  const pending = useQuery(api.teamInvites.queries.listPending, {});

  const createInvite = useMutation(api.teamInvites.mutations.create);
  const revokeInvite = useMutation(api.teamInvites.mutations.revoke);
  const setActive = useMutation(api.teamInvites.mutations.setMemberActive);
  const removeMember = useMutation(api.teamInvites.mutations.removeMember);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<EventLevel>("create");
  const [extras, setExtras] = useState<string[]>([
    PERMISSIONS.EVENTS_UPDATE_OWN,
  ]);
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleExtra = (id: string) =>
    setExtras((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const linkFor = (token: string) =>
    `${window.location.origin}/team/invite/${token}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  const onInvite = async () => {
    setBusy(true);
    try {
      const token = await createInvite({
        email,
        name: name || undefined,
        permissions: permissionsFor(level, extras),
      });
      const url = linkFor(token);
      setInviteUrl(url);
      setEmail("");
      setName("");
      toast.success("Invite created — send them the link");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't create the invite"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Give someone access to one part of the calendar without giving them
            the rest of the business.
          </p>
        </div>
      </div>

      <Card className="border-l-3 border-l-indigo-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            Invite someone
          </CardTitle>
          <CardDescription>
            They get a link, sign in with the email address you enter here, and
            land on the page for adding events. They never see advertisers,
            invoices, payments or settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="So you can tell the rows apart"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>What happens when they add an event</Label>
            <RadioGroup
              value={level}
              onValueChange={(v) => v && setLevel(v as EventLevel)}
              className="gap-3"
            >
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem
                  value="create"
                  id="level-create"
                  className="mt-0.5"
                />
                <Label htmlFor="level-create" className="cursor-pointer block">
                  <span className="block text-sm font-medium">
                    It goes live straight away
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    No approval step. Use this for someone you trust to post
                    without review.
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem
                  value="submit"
                  id="level-submit"
                  className="mt-0.5"
                />
                <Label htmlFor="level-submit" className="cursor-pointer block">
                  <span className="block text-sm font-medium">
                    You approve it first
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    It waits in Events until you approve it.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Also allow</Label>
            {OPTIONAL_EXTRAS.map((extra) => (
              <div
                key={extra.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-sm">{extra.label}</span>
                <Switch
                  checked={extras.includes(extra.id)}
                  onCheckedChange={() => toggleExtra(extra.id)}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Only their own events, never anyone else&apos;s. Approving other
              people&apos;s submissions stays with administrators.
            </p>
          </div>

          <Button
            onClick={onInvite}
            disabled={busy || !email.trim()}
            size="lg"
          >
            {busy ? "Creating..." : "Create invite link"}
          </Button>

          {inviteUrl && (
            <div className="rounded-md border border-green-600/40 bg-green-600/5 p-4 space-y-3">
              <p className="text-sm font-medium">
                Send them this link. It works once, and expires in 30 days.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy(inviteUrl)}
                  aria-label="Copy invite link"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Nothing is emailed automatically — send it yourself, by
                whichever way you normally reach them.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-amber-500" />
            Waiting to be accepted
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending === undefined ? (
            <Skeleton className="h-16 w-full" />
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invites outstanding.
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((invite) => (
                <div
                  key={invite._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {invite.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {describe(invite.permissions)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(linkFor(invite.token))}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await revokeInvite({ id: invite._id });
                          toast.success("Invite withdrawn");
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Failed"
                          );
                        }
                      }}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Withdraw
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">People with limited access</CardTitle>
          <CardDescription>
            Turning access off is the reliable way to stop someone. Removing
            them deletes the record entirely, which puts them back to what any
            signed-in visitor can do — which on this site still includes
            submitting an event for your approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members === undefined ? (
            <Skeleton className="h-16 w-full" />
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody yet. Invites appear here once they&apos;ve been accepted.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {member.invitedName ??
                        member.invitedEmail ??
                        "Account " + member.userId.slice(-6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.invitedName && member.invitedEmail
                        ? `${member.invitedEmail} — `
                        : ""}
                      {describe(member.permissions)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={member.isActive ? "default" : "secondary"}>
                      {member.isActive ? "Active" : "Off"}
                    </Badge>
                    <Switch
                      checked={member.isActive}
                      onCheckedChange={async (checked) => {
                        try {
                          await setActive({
                            id: member._id as Id<"orgPermissions">,
                            isActive: checked,
                          });
                          toast.success(
                            checked ? "Access turned on" : "Access turned off"
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Failed"
                          );
                        }
                      }}
                      aria-label="Access on or off"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await removeMember({
                            id: member._id as Id<"orgPermissions">,
                          });
                          toast.success("Removed");
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Failed"
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
