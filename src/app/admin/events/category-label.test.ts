import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { categoryLabel } from "./event-form";

describe("the category dropdown's label", () => {
  const cats = [
    { _id: "k57csd0001", name: "CSD" },
    { _id: "k57sch0002", name: "School District" },
  ];

  it("shows the category's name", () => {
    expect(categoryLabel(cats, "k57csd0001")).toBe("CSD");
    expect(categoryLabel(cats, "k57sch0002")).toBe("School District");
  });

  it("never shows the raw id", () => {
    // The actual bug: Base UI's Select.Value renders the VALUE, so leaving it
    // to itself put "k57csd0001" on screen where "CSD" belonged.
    for (const id of ["k57csd0001", "k57sch0002", "k9unknown", "", null, undefined]) {
      expect(categoryLabel(cats, id)).not.toMatch(/^k5?7?[a-z0-9]{6,}$/);
    }
  });

  it("says No category when there is none", () => {
    expect(categoryLabel(cats, undefined)).toBe("No category");
    expect(categoryLabel(cats, null)).toBe("No category");
    expect(categoryLabel(cats, "")).toBe("No category");
    expect(categoryLabel(cats, "__none__")).toBe("No category");
  });

  it("does not print an id that matches nothing", () => {
    // A category that was deleted, or an id from another org. Wrong label is
    // survivable; a hex string the user cannot act on is not.
    expect(categoryLabel(cats, "k57deleted999")).toBe("No category");
  });

  it("copes with the categories not having loaded yet", () => {
    // useQuery returns undefined on first render; the form passes [].
    expect(categoryLabel([], "k57csd0001")).toBe("No category");
  });
});

describe("no select may render a raw value by accident", () => {
  // This is Base UI, not Radix. `<SelectValue />` with no children renders
  // whatever the value is — fine when the value is the label ("2027"), and a
  // bug the moment the value is a document id. That distinction is invisible
  // at the call site, so it is written down here.
  //
  // If you add a select whose values are ids, give SelectValue children that
  // resolve the label. If its values really are human-readable, add the file
  // to the list below and say so.
  const VALUE_IS_THE_LABEL = [
    "src/app/admin/page.tsx",                    // edition year: 2027
    "src/app/admin/settings/page.tsx",           // default year
    "src/app/admin/billing/cash-flow/page.tsx",  // edition year
    "src/app/admin/print/page.tsx",              // edition year
  ];

  function tsxFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...tsxFiles(full));
      } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
        out.push(full);
      }
    }
    return out;
  }

  it("every SelectValue either has children or is a known label-as-value", () => {
    const root = path.resolve(__dirname, "../../..");          // src/
    const appDir = path.join(root, "app");
    const offenders: string[] = [];

    for (const file of tsxFiles(appDir)) {
      const src = readFileSync(file, "utf8");
      if (!/<SelectValue[^>]*\/>/.test(src)) continue;
      const rel = path.relative(path.resolve(root, ".."), file);
      if (!VALUE_IS_THE_LABEL.includes(rel)) offenders.push(rel);
    }

    expect(offenders).toEqual([]);
  });
});
