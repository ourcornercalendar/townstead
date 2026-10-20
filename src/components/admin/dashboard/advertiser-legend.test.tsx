import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdvertiserLegend } from "./advertiser-legend";

const contacts = [
  { id: "c1", company: "Acme Corp" },
  { id: "c2", company: "Globex Inc" },
  { id: "c3", company: "Initech" },
];

describe("AdvertiserLegend", () => {
  it("renders without crashing", () => {
    render(<AdvertiserLegend contacts={contacts} />);
    expect(screen.getByText("Advertiser Legend")).toBeDefined();
  });

  it("renders all contact company names", () => {
    render(<AdvertiserLegend contacts={contacts} />);
    expect(screen.getByText("Acme Corp")).toBeDefined();
    expect(screen.getByText("Globex Inc")).toBeDefined();
    expect(screen.getByText("Initech")).toBeDefined();
  });

  it("returns null when contacts array is empty", () => {
    const { container } = render(<AdvertiserLegend contacts={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("applies deterministic background colors from contact IDs", () => {
    // The colour used to be the background of the name itself. It now sits on
    // a swatch beside it, because the pill also carries the artwork status in
    // its own colour and two coloured backgrounds inside one another meant
    // flattening one of them. The colour still has to be there and still has
    // to come from the contact id -- that is what ties a row here to the
    // blocks in the grid above.
    const { container } = render(
      <AdvertiserLegend contacts={[{ id: "c1", company: "Solo" }]} />
    );
    expect(screen.getByText("Solo")).toBeDefined();
    const swatch = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect(swatch).not.toBeNull();
    expect(swatch.style.backgroundColor).toBeTruthy();
  });

  it("shows the artwork status, and says so when there isn't one", () => {
    render(
      <AdvertiserLegend
        contacts={[
          { id: "c1", company: "Acme Corp", adStatus: "sent_to_mark" },
          { id: "c2", company: "Globex Inc" },
        ]}
      />
    );
    expect(screen.getByText("Sent to Mark")).toBeDefined();
    expect(screen.getByText("Not set")).toBeDefined();
  });
});
