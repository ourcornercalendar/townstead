"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { useDefaultYear } from "@/hooks/use-default-year";
import { monthlyPricesSchema } from "@/lib/validators";
import type { z } from "zod";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { dollarsToCents, centsToDollars } from "@/lib/utils";
import { useState, useEffect } from "react";

type MonthlyPricesValues = z.infer<typeof monthlyPricesSchema>;

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

const MONTH_LABELS: Record<(typeof MONTHS)[number], string> = {
  jan: "January", feb: "February", mar: "March", apr: "April",
  may: "May", jun: "June", jul: "July", aug: "August",
  sep: "September", oct: "October", nov: "November", dec: "December",
};

const DEFAULT_PRICES: MonthlyPricesValues = {
  jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
  jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
};

interface AdPricingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advertisement: Doc<"advertisements"> | null;
}

export function AdPricingForm({
  open,
  onOpenChange,
  advertisement,
}: AdPricingFormProps) {
  const { orgId, isReady } = useOrg();
  const { defaultYear } = useDefaultYear();
  const upsertMutation = useMutation(api.adPricing.mutations.upsert);
  const [isPending, setIsPending] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<string>("");
  // Pricing is being set for the calendar being sold, not the one on the wall.
  const [year, setYear] = useState(defaultYear);
  const [setAllValue, setSetAllValue] = useState("");

  const editions = useQuery(
    api.calendarEditions.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );

  const existingPricing = useQuery(
    api.adPricing.queries.getByAdEditionYear,
    advertisement && selectedEdition
      ? {
          advertisementId: advertisement._id,
          calendarEditionId: selectedEdition as Id<"calendarEditions">,
          year,
        }
      : "skip"
  );

  const form = useForm<MonthlyPricesValues>({
    resolver: zodResolver(monthlyPricesSchema),
    defaultValues: DEFAULT_PRICES,
  });

  useEffect(() => {
    if (existingPricing) {
      const dollarsValues: MonthlyPricesValues = {} as MonthlyPricesValues;
      for (const m of MONTHS) {
        dollarsValues[m] = centsToDollars(existingPricing.monthlyPrices[m]);
      }
      form.reset(dollarsValues);
    } else if (existingPricing === null) {
      form.reset(DEFAULT_PRICES);
    }
  }, [existingPricing, form]);

  useEffect(() => {
    if (!open) {
      setSelectedEdition("");
      setYear(defaultYear);
      setSetAllValue("");
      form.reset(DEFAULT_PRICES);
    }
  }, [open, form, defaultYear]);

  const handleSetAll = () => {
    const value = parseFloat(setAllValue);
    if (isNaN(value) || value < 0) return;
    MONTHS.forEach((month) => form.setValue(month, value));
  };

  const onSubmit = async (values: MonthlyPricesValues) => {
    if (!orgId || !advertisement || !selectedEdition) return;
    setIsPending(true);
    try {
      const centsValues: MonthlyPricesValues = {} as MonthlyPricesValues;
      for (const m of MONTHS) {
        centsValues[m] = dollarsToCents(values[m]);
      }
      await upsertMutation({
        orgId,
        advertisementId: advertisement._id,
        calendarEditionId: selectedEdition as Id<"calendarEditions">,
        year,
        monthlyPrices: centsValues,
      });
      toast.success("Pricing saved");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save pricing");
    } finally {
      setIsPending(false);
    }
  };

  if (!advertisement) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ad Pricing — {advertisement.name}</SheetTitle>
          <SheetDescription>
            Set monthly prices per calendar edition and year.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Calendar Edition</Label>
              <Select
                value={selectedEdition}
                onValueChange={(v) => setSelectedEdition(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select edition">
                    {editions?.find((ed) => ed._id === selectedEdition)?.name ??
                      "Select edition"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {editions?.map((edition) => (
                    <SelectItem key={edition._id} value={edition._id}>
                      {edition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Edition Year</Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || defaultYear)}
              />
            </div>
          </div>

          {selectedEdition && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label>Set All Months</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={setAllValue}
                      onChange={(e) => setSetAllValue(e.target.value)}
                    />
                    <Button type="button" variant="secondary" onClick={handleSetAll}>
                      Apply
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {MONTHS.map((month) => (
                    <FormField
                      key={month}
                      control={form.control}
                      name={month}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            {MONTH_LABELS[month]}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <SheetFooter>
                  <Button type="submit" disabled={isPending || !selectedEdition}>
                    {isPending ? "Saving..." : "Save Pricing"}
                  </Button>
                </SheetFooter>
              </form>
            </Form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
