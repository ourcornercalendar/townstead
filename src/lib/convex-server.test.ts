import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The server-side Convex client must carry the caller's identity.
 *
 * It did not, for a while, and nothing said so: every PDF, every invoice email
 * and the advertiser portal invite call Convex from the server through this
 * one helper, and not one of those routes has a test. The functions they call
 * perform authentication now, so a client with no token fails all of them with
 * "Not authenticated".
 *
 * These are cheap tests for an expensive mistake.
 */

const setAuth = vi.fn();
const constructed: string[] = [];

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    constructor(url: string) {
      constructed.push(url);
    }
    setAuth = setAuth;
  },
}));

const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ getToken }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  constructed.length = 0;
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
});

describe("getConvexClient", () => {
  it("attaches the caller's Clerk token", async () => {
    getToken.mockResolvedValue("a-real-token");
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(setAuth).toHaveBeenCalledWith("a-real-token");
  });

  it("asks for the `convex` JWT template, the one the browser uses", async () => {
    // A token from any other template presents a different audience and is
    // rejected by convex/auth.config.ts, which would look exactly like being
    // signed out.
    getToken.mockResolvedValue("a-real-token");
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(getToken).toHaveBeenCalledWith({ template: "convex" });
  });

  it("builds a new client every time rather than sharing one", async () => {
    // A cached client plus a token means one person's identity is handed to
    // the next person's request.
    getToken.mockResolvedValue("a-real-token");
    const { getConvexClient } = await import("./convex-server");

    const first = await getConvexClient();
    const second = await getConvexClient();

    expect(first).not.toBe(second);
    expect(constructed).toHaveLength(2);
  });

  it("still returns a client when there is no token", async () => {
    // Signed out. The call will fail at Convex with its own message, which is
    // the right place for it -- this helper does not decide who may do what.
    getToken.mockResolvedValue(null);
    const { getConvexClient } = await import("./convex-server");

    const client = await getConvexClient();

    expect(client).toBeDefined();
    expect(setAuth).not.toHaveBeenCalled();
  });

  it("fails loudly when the deployment URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    const { getConvexClient } = await import("./convex-server");

    await expect(getConvexClient()).rejects.toThrow(
      /Missing NEXT_PUBLIC_CONVEX_URL/
    );
  });
});
