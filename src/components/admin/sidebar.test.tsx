import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("@/hooks/use-org", () => ({
  useOrg: () => ({ orgId: null, isReady: false }),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

// A stub that actually toggles. The previous version rendered a plain div,
// so clicking the trigger never called onOpenChange and any test of the
// open/closed behaviour would have passed without exercising it.
//
// Content is always rendered, open or not, so the "shows every page" tests
// read the full list regardless of group state.
vi.mock("@/components/ui/collapsible", async () => {
  const React = await import("react");
  const Ctx = React.createContext<{ toggle: () => void }>({ toggle: () => {} });
  return {
    Collapsible: ({ children, open, onOpenChange }: any) => (
      <Ctx.Provider value={{ toggle: () => onOpenChange?.(!(open !== false)) }}>
        <div>{children}</div>
      </Ctx.Provider>
    ),
    CollapsibleTrigger: ({ children, onClick, ...props }: any) => {
      const { toggle } = React.useContext(Ctx);
      return (
        <button
          onClick={(e: any) => {
            onClick?.(e);
            toggle();
          }}
          {...props}
        >
          {children}
        </button>
      );
    },
    CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  };
});

import { AdminSidebar, AdminSidebarMobile } from "./sidebar";

beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
});

describe("AdminSidebar", () => {
  it("renders without crashing", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Planner App")).toBeDefined();
  });

  it("shows every page, not just the ones outside a collapsed group", () => {
    render(<AdminSidebar />);
    for (const label of [
      "Dashboard", "Calendars", "Events", "Categories", "Export Events",
      "Print Inventory", "Advertisements", "Purchases", "Contacts",
      "Address Books", "Billing", "Payments", "Approvals", "Blog",
      "Coupons", "Videos", "Communities", "Site Branding", "Settings",
    ]) {
      expect(screen.getByText(label), `${label} is missing`).toBeDefined();
    }
  });

  it("groups pages by the job being done", () => {
    render(<AdminSidebar />);
    for (const group of ["The Calendar", "Ad Sales", "Money", "Website"]) {
      expect(screen.getByText(group), `${group} is missing`).toBeDefined();
    }
  });

  it("no longer hides anything behind 'Community Site'", () => {
    render(<AdminSidebar />);
    expect(screen.queryByText("Community Site")).toBeNull();
  });

  it("links point at the right routes", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Calendars").closest("a")?.getAttribute("href")).toBe("/admin/calendars");
    expect(screen.getByText("Communities").closest("a")?.getAttribute("href")).toBe("/admin/communities");
    expect(screen.getByText("Print Inventory").closest("a")?.getAttribute("href")).toBe("/admin/print");
    expect(screen.getByText("Export Events").closest("a")?.getAttribute("href")).toBe("/admin/events/export");
  });

  it("marks the current page, and only the current page", () => {
    // usePathname is mocked to "/admin".
    render(<AdminSidebar />);
    const active = document.querySelectorAll("a[data-active]");
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain("Dashboard");
  });
});

describe("the jump box", () => {
  const box = () => screen.getByLabelText("Search admin pages");

  it("is there", () => {
    render(<AdminSidebar />);
    expect(box()).toBeDefined();
  });

  it("replaces the groups with matching pages as you type", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "categ" } });

    const results = screen.getByRole("navigation", { name: "Search results" });
    expect(within(results).getByText("Categories")).toBeDefined();
    // The groups are gone while searching, so there is one obvious list.
    expect(screen.queryByText("Ad Sales")).toBeNull();
    expect(within(results).queryByText("Payments")).toBeNull();
  });

  it("finds a page by a word that is not in its name", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "ads" } });
    const results = screen.getByRole("navigation", { name: "Search results" });
    expect(within(results).getByText("Advertisements")).toBeDefined();
  });

  it("shows which group a result belongs to", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "events" } });
    const results = screen.getByRole("navigation", { name: "Search results" });
    expect(within(results).getAllByText("The Calendar").length).toBeGreaterThan(0);
  });

  it("says so when nothing matches, rather than showing an empty list", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "zzzznope" } });
    expect(screen.getByText(/Nothing matches/)).toBeDefined();
  });

  it("goes to the first result on Enter", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "print" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/admin/print");
  });

  it("moves down the results with the arrow keys", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "billing" } });
    const results = screen.getByRole("navigation", { name: "Search results" });
    const hrefs = within(results)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(1);

    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(push).toHaveBeenCalledWith(hrefs[1]);
  });

  it("clears on Escape and brings the groups back", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "print" } });
    expect(screen.queryByText("Ad Sales")).toBeNull();
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(screen.getByText("Ad Sales")).toBeDefined();
  });

  it("does nothing on Enter when nothing matches", () => {
    render(<AdminSidebar />);
    fireEvent.change(box(), { target: { value: "zzzznope" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
  });
});

describe("remembering which groups are open", () => {
  it("saves a collapse so it survives the next page", () => {
    render(<AdminSidebar />);
    fireEvent.click(screen.getByText("Ad Sales"));
    const saved = JSON.parse(window.localStorage.getItem("townstead.admin.openGroups.v1") || "{}");
    expect(saved.sales).toBe(false);
  });

  it("starts with everything open when there is nothing saved", () => {
    render(<AdminSidebar />);
    // Nothing written until the user actually collapses something, so the
    // default can never be "hidden".
    expect(window.localStorage.getItem("townstead.admin.openGroups.v1")).toBeNull();
  });

  it("survives localStorage being unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<AdminSidebar />);
    expect(() => fireEvent.click(screen.getByText("Money"))).not.toThrow();
    spy.mockRestore();
  });

  it("ignores a corrupt saved value", () => {
    window.localStorage.setItem("townstead.admin.openGroups.v1", "not json");
    expect(() => render(<AdminSidebar />)).not.toThrow();
    expect(screen.getByText("Events")).toBeDefined();
  });
});

describe("AdminSidebarMobile", () => {
  it("renders nav items and children", () => {
    render(
      <AdminSidebarMobile>
        <div data-testid="child-content">Extra</div>
      </AdminSidebarMobile>,
    );
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByTestId("child-content")).toBeDefined();
  });

  it("calls onNavigate when a link is clicked", () => {
    const onNavigate = vi.fn();
    render(<AdminSidebarMobile onNavigate={onNavigate}>extra</AdminSidebarMobile>);
    screen.getByText("Billing").click();
    expect(onNavigate).toHaveBeenCalled();
  });

  it("closes the drawer after jumping from the search box", () => {
    const onNavigate = vi.fn();
    render(<AdminSidebarMobile onNavigate={onNavigate}>extra</AdminSidebarMobile>);
    const box = screen.getByLabelText("Search admin pages");
    fireEvent.change(box, { target: { value: "print" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/admin/print");
  });
});
