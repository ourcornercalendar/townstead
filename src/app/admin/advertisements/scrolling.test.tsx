import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

/**
 * One scrolling list, arranged by hand.
 *
 * The advertisements table used to page at ten rows, so Joyce's placements
 * were spread across screens she had to click between. It now shows the lot
 * and she arranges the order with arrows.
 *
 * These check the two things she asked for, at the level she sees them: no
 * pager, and the arrows moving the right row in the right direction.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" }, isLoaded: true }),
  useUser: () => ({ user: null, isLoaded: true }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
  useConvex: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ad = any;

function ad(name: string, isDayType = false): Ad {
  return {
    _id: `ad_${name.replace(/\s+/g, "_")}`,
    name,
    isDayType,
    slotsPerMonth: 1,
    orgId: "org_1",
  };
}

const JOYCES_ORDER = [
  "Billboard",
  "Premium Display",
  "Monthly Photo",
  "Display",
  "Date Blocks",
  "Coupons",
  "Junior Coupons",
];

function renderTable(
  rows: Ad[],
  opts: {
    onMove?: (index: number, direction: -1 | 1) => void;
    sortingActive?: boolean;
  } = {}
) {
  render(
    <DataTable
      columns={columns({
        onPricing: vi.fn(),
        onMove: opts.onMove,
        sortingActive: opts.sortingActive,
      })}
      data={rows}
      noPagination
      searchKey="name"
    />
  );
}

function namesOnScreen(): string[] {
  // The name is the cell after the arrows column.
  return Array.from(
    document.querySelectorAll("tbody tr td:nth-child(2)")
  ).map((c) => c.textContent?.trim() ?? "");
}

describe("no more clicking between pages", () => {
  it("shows every advertisement at once, well past the old ten-row page", () => {
    const rows = [
      ...JOYCES_ORDER.map((n) => ad(n)),
      ...Array.from({ length: 8 }, (_, i) => ad(`Day Square ${i + 1}`, true)),
    ];
    renderTable(rows, { onMove: vi.fn() });

    expect(document.querySelectorAll("tbody tr")).toHaveLength(15);
    expect(namesOnScreen()).toContain("Junior Coupons");
  });

  it("renders no pager", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ad(`Ad ${i}`));
    renderTable(rows, { onMove: vi.fn() });

    // The pager is a row of page-number buttons with aria-current on one.
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(30);
  });
});

describe("the arrows", () => {
  it("moves a row down by one", () => {
    const onMove = vi.fn();
    renderTable(JOYCES_ORDER.map((n) => ad(n)), { onMove });

    const downs = document.querySelectorAll('[aria-label="Move down"]');
    fireEvent.click(downs[0]);

    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  it("moves a row up by one", () => {
    const onMove = vi.fn();
    renderTable(JOYCES_ORDER.map((n) => ad(n)), { onMove });

    const ups = document.querySelectorAll('[aria-label="Move up"]');
    fireEvent.click(ups[3]);

    expect(onMove).toHaveBeenCalledWith(3, -1);
  });

  it("is switched off while a column sort is active", () => {
    // Moving a row "up" means nothing when the rows on screen are not in the
    // stored order. Better plainly unavailable than quietly wrong.
    renderTable(JOYCES_ORDER.map((n) => ad(n)), {
      onMove: vi.fn(),
      sortingActive: true,
    });

    const ups = Array.from(
      document.querySelectorAll('[aria-label="Move up"]')
    ) as HTMLButtonElement[];
    expect(ups.length).toBeGreaterThan(0);
    expect(ups.every((b) => b.disabled)).toBe(true);
  });

  it("does not appear at all when reordering is not offered", () => {
    render(
      <DataTable
        columns={columns({ onPricing: vi.fn() })}
        data={JOYCES_ORDER.map((n) => ad(n))}
        noPagination
      />
    );
    expect(document.querySelector('[aria-label="Move up"]')).toBeNull();
  });
});
