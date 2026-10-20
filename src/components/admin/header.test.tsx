import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  // The sidebar's jump box navigates with the router, so this mock needs it
  // too — the header renders AdminSidebarMobile.
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

import { AdminHeader } from "./header";

describe("AdminHeader", () => {
  it("renders without crashing", () => {
    render(<AdminHeader />);
    expect(screen.getByTestId("user-button")).toBeDefined();
  });

  it("renders the OrganizationSwitcher", () => {
    render(<AdminHeader />);
    const switchers = screen.getAllByTestId("org-switcher");
    expect(switchers.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the mobile menu toggle", () => {
    render(<AdminHeader />);
    expect(screen.getByText("Toggle menu")).toBeDefined();
  });
});
