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

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (token) {
    client.setAuth(token);
  }

  return client;
}
