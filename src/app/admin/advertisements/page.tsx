"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { SortingState } from "@tanstack/react-table";
import { columns } from "./columns";
import { AdvertisementForm } from "./advertisement-form";
import { AdPricingForm } from "./ad-pricing-form";
import type { Doc } from "../../../../convex/_generated/dataModel";

export default function AdvertisementsPage() {
  const { orgId, isReady } = useOrg();
  const advertisements = useQuery(
    api.advertisements.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );
  const [formOpen, setFormOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Doc<"advertisements"> | null>(
    null
  );
  const [sortingActive, setSortingActive] = useState(false);
  const reorder = useMutation(api.advertisements.mutations.reorder);

  // The list arrives already in Joyce's order from the server, so a move is
  // "swap these two and send the whole list back". Sending the finished order
  // rather than a nudge means the server can renumber from scratch and no two
  // clicks can race into a half-applied order.
  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!advertisements || !orgId) return;
    const target = index + direction;
    if (target < 0 || target >= advertisements.length) return;

    const next = [...advertisements];
    [next[index], next[target]] = [next[target], next[index]];

    try {
      await reorder({ orgId, orderedIds: next.map((ad) => ad._id) });
    } catch {
      toast.error("Couldn't save the new order");
    }
  };

  if (!isReady || advertisements === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader title="Advertisements" />
        <TableSkeleton columns={3} rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advertisements"
        description="Manage advertisement types and their pricing"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Advertisement
          </Button>
        }
      />
      <DataTable
        columns={columns({
          onPricing: (ad) => {
            setSelectedAd(ad);
            setPricingOpen(true);
          },
          onMove: handleMove,
          sortingActive,
        })}
        data={advertisements}
        // Every advertisement on one scrolling page. It used to page at ten,
        // which is what put Joyce's placements across several screens.
        noPagination
        onSortingChange={(sorting: SortingState) =>
          setSortingActive(sorting.length > 0)
        }
        searchKey="name"
        searchPlaceholder="Search advertisements..."
        emptyTitle="No advertisements"
        emptyDescription="Get started by creating your first advertisement type."
      />
      <AdvertisementForm open={formOpen} onOpenChange={setFormOpen} />
      <AdPricingForm
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        advertisement={selectedAd}
      />
    </div>
  );
}
