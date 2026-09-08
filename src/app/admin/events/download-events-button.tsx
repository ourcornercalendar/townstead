"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useDefaultYear } from "@/hooks/use-default-year";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

// Falls back to the current year only when a typed year is unreadable;
// the value the field opens on is the calendar being sold, below.
const currentYear = new Date().getFullYear();

function clampYear(n: number): number {
  if (!Number.isFinite(n)) return currentYear;
  return Math.min(2100, Math.max(2000, Math.round(n)));
}

export function DownloadEventsButton({
  calendarEditions,
}: {
  calendarEditions: Doc<"calendarEditions">[];
}) {
  const { defaultYear } = useDefaultYear();
  const [open, setOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(defaultYear));
  const [editionSelect, setEditionSelect] = useState<string>("all");

  const handleDownload = () => {
    const year = clampYear(parseInt(yearInput, 10));
    const params = new URLSearchParams({ year: String(year) });
    if (editionSelect !== "all") {
      params.set("calendarEditionId", editionSelect);
    }
    window.open(`/api/pdf/calendar?${params}`, "_blank");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Download className="mr-2 h-4 w-4" />
        Download Events
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Calendar PDF</DialogTitle>
          <DialogDescription>
            Pick the year and calendar edition you want a printable calendar
            for. A 12-month landscape PDF will download.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="download-events-year">Calendar Year</Label>
            <Input
              id="download-events-year"
              type="number"
              min={2000}
              max={2100}
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onBlur={() =>
                setYearInput(String(clampYear(parseInt(yearInput, 10))))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="download-events-edition">Calendar Edition</Label>
            <Select
              value={editionSelect}
              onValueChange={(v) => setEditionSelect(v ?? "all")}
            >
              <SelectTrigger id="download-events-edition" className="w-full">
                <SelectValue placeholder="All editions">
                  {editionSelect === "all"
                    ? "All editions"
                    : (calendarEditions.find(
                        (c) => c._id === (editionSelect as Id<"calendarEditions">)
                      )?.name ?? "All editions")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All editions</SelectItem>
                {calendarEditions.map((edition) => (
                  <SelectItem key={edition._id} value={edition._id}>
                    {edition.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
