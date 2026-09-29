import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

/**
 * A Convex client for server code, carrying the signed-in person's identity.
 *
 * This used to hand back a module-level client with no token on it at all.
 * That worked only because the functions it called performed no authentication
 * -- once they did, every PDF, every invoice email and the portal invite began
 * failing with "Not authenticated", and nothing noticed because no test
 * touches an API route.
 *
 * Two things matter here:
 *
 * **A new client per request.** The old one was cached in a module variable.
 * The moment a token is attached, a shared client hands one person's identity
 * to the next person's request -- on a server that serves everybody.
 *
 * **The `convex` JWT template.** The browser reaches Convex through
 * `ConvexProviderWithClerk`, which asks Clerk for a token from the template
 * named `convex`; this asks for the same one, so both sides present the same
 * identity to the same `auth.config.ts`.
 */
export async function getConvexClient(): Promise<ConvexHttpClient> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");

  // Never cached: see above.
  const client = new ConvexHttpClient(url);

  const { getToken, sessionClaims } = await auth();
  const token = await fetchConvexToken(getToken, sessionClaims);
  if (token) {
    client.setAuth(token);
  }

  return client;
}

/** Does this session token already say it is for Convex? */
function audienceIsConvex(claims: unknown): boolean {
  const aud = (claims as { aud?: unknown } | null | undefined)?.aud;
  return aud === "convex" || (Array.isArray(aud) && aud.includes("convex"));
}

/**
 * Ask Clerk for a token Convex will accept.
 *
 * There are two ways a Clerk project can be wired to Convex, and which one you
 * have decides where the token comes from:
 *
 * - **the newer integration** — the ordinary session token already carries
 *   `aud: "convex"`, and there is no JWT template of that name. Asking for one
 *   returns nothing.
 * - **the older setup** — a JWT template named `convex` mints the token.
 *
 * This mirrors what `ConvexProviderWithClerk` does in the browser, which is
 * why the site's own pages work: it checks the audience first and only falls
 * back to the template. Asking only for the template, as this did at first,
 * quietly produced no token on a project using the newer integration -- and an
 * absent token looks exactly like being signed out, so a PDF came back as
 * "Calendar edition not found" rather than saying anything about sign-in.
 */
async function fetchConvexToken(
  getToken: (opts?: { template?: string }) => Promise<string | null>,
  sessionClaims: unknown
): Promise<string | null> {
  const attempts = audienceIsConvex(sessionClaims)
    ? [undefined, { template: "convex" }]
    : [{ template: "convex" }, undefined];

  for (const opts of attempts) {
    try {
      const token = opts ? await getToken(opts) : await getToken();
      if (token) return token;
    } catch {
      // A template that does not exist throws rather than returning null.
      // Try the other way before giving up.
    }
  }
  return null;
}
