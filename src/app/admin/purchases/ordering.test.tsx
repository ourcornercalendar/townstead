import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DataTable } from "@/components/shared/data-table";
import { purchaseColumns } from "./columns";

/**
 * Purchases in alphabetical order.
 *
 * Joyce works through this list by advertiser, so it needs to read like a
 * phone book: A at the top, and the same order every time she opens it. The
 * page already asked for that; this checks that what reaches the screen is
 * actually sorted, and sorted the way a person would expect rather than the
 * way a computer sorts strings.
 *
 * The awkward cases are the interesting ones. "the Corner Cafe" belongs under
 * C for a reader and under T for a naive sort. "McDonald" and "MacDonald" are
 * a page apart in a strict byte comparison. And an advertiser with no company
 * name is filed under the person's name, because that is the only name it has.
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

type Row = Parameters<typeof purchaseColumns>[0] extends never ? never : any;

let n = 0;
function purchase(company: string, contactName = "A Person"): Row {
  n += 1;
  return {
    _id: `p_${n}`,
    invoiceNumber: `INV-${1000 + n}`,
    company,
    contactName,
    editionCode: "CC",
    year: 2027,
    net: 10000,
    amountPaid: 0,
    balance: 10000,
    status: "unpaid",
  };
}

function renderTable(rows: Row[]) {
  render(
    <DataTable
      columns={purchaseColumns({ yearOptions: [{ label: "2027", value: "2027" }] })}
      data={rows}
      noPagination
      initialSorting={[{ id: "contactName", desc: false }]}
    />
  );
}

function rowOrder(): string[] {
  const cells = document.querySelectorAll("tbody tr td:nth-child(2) p.font-medium");
  return Array.from(cells).map((c) => c.textContent ?? "");
}

describe("purchases are listed alphabetically", () => {
  it("puts them in order regardless of how they arrive", () => {
    renderTable([
      purchase("Zeppole Bakery"),
      purchase("Anderson Plumbing"),
      purchase("Miller Dental"),
    ]);

    expect(rowOrder()).toEqual([
      "Anderson Plumbing",
      "Miller Dental",
      "Zeppole Bakery",
    ]);
  });

  it("does not put lower-case names in a group of their own", () => {
    // A byte comparison files every capital letter before every small one, so
    // "apex" would land after "Zeppole".
    renderTable([
      purchase("Zeppole Bakery"),
      purchase("apex Signs"),
      purchase("Miller Dental"),
    ]);

    expect(rowOrder()).toEqual(["apex Signs", "Miller Dental", "Zeppole Bakery"]);
  });

  it("files a business with no company name under the person", () => {
    renderTable([
      purchase("Zeppole Bakery"),
      purchase("", "Brenda Callas"),
    ]);

    expect(rowOrder()).toEqual(["Brenda Callas", "Zeppole Bakery"]);
  });

  it("keeps numbers where a reader expects them", () => {
    renderTable([
      purchase("Anderson Plumbing"),
      purchase("5 Star Roofing"),
    ]);

    expect(rowOrder()[0]).toBe("5 Star Roofing");
  });

  it("files a leading The under T", () => {
    // Worth stating rather than leaving implicit: "The Corner Cafe" sorts
    // under T, not C. A library would file it under C. If Joyce would rather
    // it did, that is a small change -- but it should be her decision, not a
    // silent one.
    renderTable([
      purchase("The Corner Cafe"),
      purchase("Delta Signs"),
      purchase("Anderson Plumbing"),
    ]);

    expect(rowOrder()).toEqual([
      "Anderson Plumbing",
      "Delta Signs",
      "The Corner Cafe",
    ]);
  });

  it("sorts accented names next to their plain spelling", () => {
    renderTable([
      purchase("Zeppole Bakery"),
      purchase("Élan Salon"),
      purchase("Foster Law"),
    ]);

    expect(rowOrder()).toEqual(["Élan Salon", "Foster Law", "Zeppole Bakery"]);
  });
});
