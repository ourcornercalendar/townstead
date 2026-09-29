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
let sessionClaims: unknown = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ getToken, sessionClaims }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  constructed.length = 0;
  sessionClaims = null;
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
});

describe("getConvexClient", () => {
  it("attaches the caller's Clerk token", async () => {
    getToken.mockResolvedValue("a-real-token");
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(setAuth).toHaveBeenCalledWith("a-real-token");
  });

  it("asks for the `convex` JWT template when the session is not already for Convex", async () => {
    sessionClaims = { aud: "some-other-audience" };
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

describe("the two ways Clerk can be wired to Convex", () => {
  // Convex's own ConvexProviderWithClerk checks the audience first and only
  // falls back to the named template. The server has to do the same, or a
  // project on the newer integration gets no token at all -- which is what
  // turned a calendar download into "Calendar edition not found".

  it("uses the plain session token when it already says aud: convex", async () => {
    sessionClaims = { aud: "convex" };
    getToken.mockImplementation(async (opts?: { template?: string }) =>
      opts?.template ? null : "session-token"
    );
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(setAuth).toHaveBeenCalledWith("session-token");
  });

  it("accepts aud given as a list", async () => {
    sessionClaims = { aud: ["convex", "something-else"] };
    getToken.mockImplementation(async (opts?: { template?: string }) =>
      opts?.template ? null : "session-token"
    );
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(setAuth).toHaveBeenCalledWith("session-token");
  });

  it("falls back to the session token when the template does not exist", async () => {
    // The exact failure Joyce hit: no template of that name, so the call
    // throws, and asking only for the template left the request anonymous.
    sessionClaims = null;
    getToken.mockImplementation(async (opts?: { template?: string }) => {
      if (opts?.template) throw new Error("No JWT template exists with name: convex");
      return "session-token";
    });
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(setAuth).toHaveBeenCalledWith("session-token");
  });

  it("falls back to the template when the session token is empty", async () => {
    sessionClaims = { aud: "convex" };
    getToken.mockImplementation(async (opts?: { template?: string }) =>
      opts?.template ? "template-token" : null
    );
    const { getConvexClient } = await import("./convex-server");

    await getConvexClient();

    expect(setAuth).toHaveBeenCalledWith("template-token");
  });

  it("gives up quietly when neither works", async () => {
    getToken.mockResolvedValue(null);
    const { getConvexClient } = await import("./convex-server");

    const client = await getConvexClient();

    expect(client).toBeDefined();
    expect(setAuth).not.toHaveBeenCalled();
  });
});
