import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  NAV_GROUPS,
  ALL_DESTINATIONS,
  DASHBOARD,
  SETTINGS,
  activeHref,
  matchesQuery,
} from "./nav-items";

const hrefs = ALL_DESTINATIONS.map((e) => e.item.href);

describe("every admin page can be reached", () => {
  // The test that matters most here.
  //
  // Before this change, /admin/print and /admin/events/export existed, worked,
  // and had no link to them from anywhere in the interface — you could only
  // get there by typing the URL. Nothing noticed for months, because nothing
  // was looking. This looks.
  //
  // If you add a page under src/app/admin and this fails, that is the point:
  // either give it a row in the sidebar, or add it to the jump box with
  // searchOnly, or deliberately list it below as not-navigable.
  const ADMIN_DIR = path.resolve(__dirname, "../../app/admin");

  /** Pages that are reached from inside another page, not from the nav. */
  const REACHED_FROM_A_PAGE = [
    "/admin/billing/payments",   // tab on the Billing page
    "/admin/blog/new",           // "New post" button
    "/admin/purchases/new",      // "New purchase" button
  ];

  function routesOnDisk(dir: string, prefix = "/admin"): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (entry === "page.tsx") {
        out.push(prefix);
        continue;
      }
      if (!statSync(full).isDirectory()) continue;
      // [id] and the like are detail pages opened from a list, never nav rows.
      if (entry.startsWith("[") || entry.startsWith("(")) continue;
      out.push(...routesOnDisk(full, `${prefix}/${entry}`));
    }
    return out;
  }

  it("has no page that nothing links to", () => {
    const onDisk = routesOnDisk(ADMIN_DIR);
    const unreachable = onDisk.filter(
      (r) => !hrefs.includes(r) && !REACHED_FROM_A_PAGE.includes(r)
    );
    expect(unreachable).toEqual([]);
  });

  it("points at no page that does not exist", () => {
    const onDisk = routesOnDisk(ADMIN_DIR);
    const dangling = hrefs.filter((h) => !onDisk.includes(h));
    expect(dangling).toEqual([]);
  });
});

describe("the sidebar structure", () => {
  it("lists every destination exactly once", () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("puts Events and Categories in the same group, both visible", () => {
    // The original complaint: these two were buried in a collapsed group
    // called "Community Site" and could not be found.
    const calendar = NAV_GROUPS.find((g) => g.id === "calendar");
    expect(calendar).toBeDefined();
    const visible = calendar!.items.filter((i) => !i.searchOnly).map((i) => i.href);
    expect(visible).toContain("/admin/events");
    expect(visible).toContain("/admin/categories");
  });

  it("has no group called Community Site", () => {
    expect(NAV_GROUPS.map((g) => g.label)).not.toContain("Community Site");
  });

  it("gives every group at least two visible rows", () => {
    for (const g of NAV_GROUPS) {
      const visible = g.items.filter((i) => !i.searchOnly);
      expect(visible.length, `${g.label} has ${visible.length} visible rows`).toBeGreaterThan(1);
    }
  });
});

describe("which row is highlighted", () => {
  it("highlights the dashboard only on the dashboard", () => {
    expect(activeHref("/admin")).toBe("/admin");
    expect(activeHref("/admin/events")).toBe("/admin/events");
  });

  it("picks the most specific match, not the first", () => {
    // /admin/events/export starts with /admin/events. A plain startsWith
    // lights up both rows; the longest match has to win.
    expect(activeHref("/admin/events/export")).toBe("/admin/events/export");
    expect(activeHref("/admin/billing/cash-flow")).toBe("/admin/billing/cash-flow");
  });

  it("highlights the list page from one of its detail pages", () => {
    expect(activeHref("/admin/contacts/abc123")).toBe("/admin/contacts");
    expect(activeHref("/admin/purchases/xyz/invoice")).toBe("/admin/purchases");
  });

  it("does not highlight a row whose href is merely a prefix of the name", () => {
    // "/admin/events" must not light up for "/admin/events-archive".
    expect(activeHref("/admin/eventsomething")).toBe(null);
  });

  it("highlights nothing for a page outside the admin", () => {
    expect(activeHref("/event-desk")).toBe(null);
  });
});

describe("the jump box", () => {
  const find = (q: string) =>
    ALL_DESTINATIONS.filter((e) => matchesQuery(e, q)).map((e) => e.item.href);

  it("finds a page by its own name", () => {
    expect(find("categories")).toEqual(["/admin/categories"]);
  });

  it("is case-insensitive", () => {
    expect(find("CATEGORIES")).toEqual(["/admin/categories"]);
  });

  it("finds a page by what it is actually called in conversation", () => {
    // Nobody says "Advertisements".
    expect(find("ads")).toContain("/admin/advertisements");
    expect(find("invoice")).toContain("/admin/billing");
    expect(find("tags")).toContain("/admin/categories");
    expect(find("staff")).toContain("/admin/settings/team");
  });

  it("finds the pages that used to be unreachable", () => {
    expect(find("print")).toContain("/admin/print");
    expect(find("export")).toContain("/admin/events/export");
    expect(find("download")).toContain("/admin/events/export");
  });

  it("finds a page by the group it lives in", () => {
    expect(find("money")).toContain("/admin/payments");
    expect(find("ad sales")).toContain("/admin/purchases");
  });

  it("narrows as more words are typed", () => {
    const one = find("cash");
    const two = find("cash flow");
    expect(two.length).toBeLessThanOrEqual(one.length);
    expect(two).toContain("/admin/billing/cash-flow");
  });

  it("matches words in any order", () => {
    expect(find("flow cash")).toContain("/admin/billing/cash-flow");
  });

  it("returns nothing for nonsense rather than everything", () => {
    expect(find("zzzznope")).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(find("   ").length).toBe(ALL_DESTINATIONS.length);
  });

  it("can reach the dashboard and settings", () => {
    expect(find("dashboard")).toContain(DASHBOARD.href);
    expect(find("settings")).toContain(SETTINGS.href);
  });
});
