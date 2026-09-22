import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/portal(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

const RESERVED_SEGMENTS = new Set([
  "events", "directory", "coupons", "blog", "videos", "profile",
  "admin", "portal", "auth", "api", "_next", "c",
  // /team/invite/<token> — without this, "team" is read as an organisation
  // slug and "invite" as a community, and the invite page never renders.
  "team",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  if (isAdminRoute(request)) {
    const { orgRole } = await auth();
    if (orgRole !== "org:admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/redirect";
      return NextResponse.redirect(url);
    }
  }

  const { pathname, searchParams } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const orgSlug = segments[0];

  if (!orgSlug || RESERVED_SEGMENTS.has(orgSlug)) return;

  const legacyCommunity = searchParams.get("community");
  if (legacyCommunity) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("community");
    const rest = segments.slice(1).join("/");
    url.pathname = `/${orgSlug}/${legacyCommunity}${rest ? `/${rest}` : ""}`;
    return NextResponse.redirect(url, 301);
  }

  if (segments[1] === "c" && segments[2]) {
    const communitySlug = segments[2];
    const rest = segments.slice(3).join("/");
    const url = request.nextUrl.clone();
    url.pathname = `/${orgSlug}/${communitySlug}${rest ? `/${rest}` : ""}`;
    return NextResponse.redirect(url, 301);
  }

  if (segments.length >= 2 && !RESERVED_SEGMENTS.has(segments[1])) {
    const communitySlug = segments[1];
    const rest = segments.slice(2).join("/");
    const url = request.nextUrl.clone();
    url.pathname = `/${orgSlug}${rest ? `/${rest}` : ""}`;
    url.searchParams.set("_community", communitySlug);
    return NextResponse.rewrite(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
