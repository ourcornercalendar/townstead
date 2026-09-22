"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser, SignInButton, SignUpButton } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, CalendarPlus, User } from "lucide-react";

export default function TeamInviteRedeemPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { user, isSignedIn, isLoaded: clerkLoaded } = useUser();

  const validation = useQuery(
    api.teamInvites.queries.validateToken,
    token ? { token } : "skip"
  );
  const redeem = useMutation(api.teamInvites.mutations.redeem);

  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clerkLoaded || validation === undefined) {
    return (
      <Shell>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="mx-auto h-12 w-12 rounded-full" />
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
        </CardContent>
      </Shell>
    );
  }

  if (!validation.valid) {
    return (
      <Shell>
        <CardContent className="space-y-4 pt-8 pb-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold tracking-tight">Invite not usable</h1>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">
            {validation.error}
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Go Home
          </Button>
        </CardContent>
      </Shell>
    );
  }

  if (redeemed) {
    return (
      <Shell>
        <CardContent className="space-y-4 pt-8 pb-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="text-xl font-bold tracking-tight">You&apos;re in</h1>
          <p className="text-sm text-muted-foreground">
            Taking you to the page for adding events...
          </p>
        </CardContent>
      </Shell>
    );
  }

  const autoApproved = validation.permissions.includes("events:create");

  // Signed out: the invite is addressed to one email, so the sign-in has to
  // happen before anything is granted. Coming back to this same page afterwards
  // is what makes the "accept" button the only thing that creates the account's
  // access.
  if (!isSignedIn) {
    return (
      <Shell>
        <CardHeader className="pb-2 text-center">
          <CalendarPlus className="mx-auto mb-2 h-10 w-10 text-indigo-500" />
          <CardTitle className="text-xl">
            {validation.name ? `Hello ${validation.name}` : "You've been invited"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-2 text-center">
          <p className="text-sm text-muted-foreground">
            {validation.orgName} has invited you to add events to their
            calendar.
          </p>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            Sign in using <strong>{validation.email}</strong> — the invite is
            for that address.
          </div>
          <div className="flex flex-col gap-2">
            <SignUpButton
              mode="modal"
              forceRedirectUrl={`/team/invite/${token}`}
            >
              <Button size="lg" className="w-full">
                Create my account
              </Button>
            </SignUpButton>
            <SignInButton
              mode="modal"
              forceRedirectUrl={`/team/invite/${token}`}
            >
              <Button size="lg" variant="outline" className="w-full">
                I already have an account
              </Button>
            </SignInButton>
          </div>
        </CardContent>
      </Shell>
    );
  }

  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress;

  return (
    <Shell>
      <CardHeader className="pb-2 text-center">
        <CalendarPlus className="mx-auto mb-2 h-10 w-10 text-indigo-500" />
        <CardTitle className="text-xl">Accept your invite</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to add events to
          </p>
          <p className="text-lg font-semibold">{validation.orgName}</p>
          <p className="text-sm text-muted-foreground">
            {autoApproved
              ? "Events you add will appear on the calendar right away."
              : "Events you add will wait for approval before appearing."}
          </p>
        </div>

        <div className="rounded-md border bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.fullName ?? "Your Account"}
              </p>
              {userEmail && (
                <p className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={redeeming}
          onClick={async () => {
            try {
              setRedeeming(true);
              setError(null);
              await redeem({ token });
              setRedeemed(true);
              const slug = validation.orgSlug;
              setTimeout(
                () => router.push(slug ? `/${slug}/events/submit` : "/"),
                1200
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Couldn't accept the invite"
              );
            } finally {
              setRedeeming(false);
            }
          }}
        >
          {redeeming ? "Setting up..." : "Accept and start adding events"}
        </Button>
      </CardContent>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}
