"use client";

import { getContactColor, getContrastText } from "@/lib/colors";
import { AdStatusBadge } from "@/components/admin/ad-status";
import type { AdStatus } from "../../../../convex/contacts/adStatus";

interface LegendContact {
  id: string;
  company: string;
  adStatus?: AdStatus;
}

export function AdvertiserLegend({ contacts }: { contacts: LegendContact[] }) {
  if (contacts.length === 0) return null;

  return (
    <div className="rounded-md border p-4 print:hidden">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Advertiser Legend
      </h3>
      <div className="flex flex-wrap gap-2">
        {contacts.map((contact) => {
          const bg = getContactColor(contact.id);
          const fg = getContrastText(bg);
          return (
            // A neutral pill carrying two pieces of colour: a dot in the
            // advertiser's own colour, which is what ties them to the grid
            // above, and the status badge in the stage's colour. Putting the
            // status inside a coloured chip would have meant flattening one
            // of the two to stay readable, and both are the point.
            <span
              key={contact.id}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background py-1 pl-2 pr-1 text-xs font-medium"
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: bg, color: fg }}
                aria-hidden
              />
              {contact.company}
              <AdStatusBadge status={contact.adStatus} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
