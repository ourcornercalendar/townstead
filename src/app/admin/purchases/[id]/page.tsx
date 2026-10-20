"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Clock, DollarSign, ExternalLink, Pencil, Plus, Trash2, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useStableNow } from "@/hooks/use-stable-now";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ScheduledPaymentsTable } from "./scheduled-payments-table";
import { RecordPaymentSheet } from "@/components/admin/record-payment-sheet";
import Link from "next/link";
import { useState } from "react";
import { AdStatusBadge } from "@/components/admin/ad-status";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  if (value == null) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{String(value)}</p>
    </div>
  );
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"purchases">;
  const now = useStableNow();
  const detail = useQuery(api.purchases.queries.getDetail, { id, now });
  const softDelete = useMutation(api.purchases.mutations.softDelete);

  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (detail === undefined) return <DetailSkeleton />;

  if (detail === null) {
    return (
      <div className="space-y-6">
        <Link href="/admin/purchases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchases
          </Button>
        </Link>
        <EmptyState
          title="Purchase not found"
          description="This purchase may have been deleted."
        />
      </div>
    );
  }

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await softDelete({ id });
      toast.success("Purchase deleted");
      router.push("/admin/purchases");
    } catch {
      toast.error("Failed to delete purchase");
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
    }
  };

  const contactName = detail.contact
    ? `${detail.contact.firstName} ${detail.contact.lastName}`
    : "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/purchases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchases
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Invoice ${detail.invoiceNumber ?? "—"}`}
        description={`${contactName} — ${detail.editions?.map((e: { name: string }) => e.name).join(", ") || "Unknown"} ${detail.year}`}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setPaymentFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
            <Link href={`/admin/purchases/${id}/invoice`}>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Invoice
              </Button>
            </Link>
            <Link href={`/admin/purchases/${id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-2 border-t-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Net</p>
              <div className="rounded-full bg-blue-100 p-1.5 dark:bg-blue-500/20">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(detail.net)}</p>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <div className="rounded-full bg-emerald-100 p-1.5 dark:bg-emerald-500/20">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(detail.amountPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Balance</p>
              <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-500/20">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(Math.max(0, detail.net - detail.amountPaid))}
            </p>
          </CardContent>
        </Card>
        <Card className={
          detail.isPaid
            ? "border-t-2 border-t-emerald-500"
            : detail.lateFees > 0
              ? "border-t-2 border-t-rose-500"
              : "border-t-2 border-t-muted-foreground/30"
        }>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="pt-1">
              {detail.isPaid ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>
              ) : detail.lateFees > 0 ? (
                <Badge variant="destructive">
                  Overdue ({formatCurrency(detail.lateFees)} in fees)
                </Badge>
              ) : detail.amountPaid > 0 ? (
                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Partial</Badge>
              ) : (
                <Badge variant="secondary">Unpaid</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="placements">Ad Placements</TabsTrigger>
          <TabsTrigger value="schedule">Scheduled Payments</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 pt-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Contact</CardTitle>
                {detail.contact && (
                  <Link href={`/admin/contacts/${detail.contact._id}`}>
                    <Button variant="ghost" size="sm">
                      View Contact
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent className="grid gap-3">
                <DetailField label="Name" value={contactName} />
                <DetailField label="Company" value={detail.contact?.company} />
                <DetailField label="Email" value={detail.contact?.email} />
                <DetailField label="Phone" value={detail.contact?.phone} />
                {/* Read-only here: the status belongs to the business, and
                    the place to change it is the business's own page. */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Ad status
                  </span>
                  <span className="col-span-2">
                    <AdStatusBadge status={detail.contact?.adStatus} />
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Terms</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <DetailField label="Total Sale" value={detail.terms ? formatCurrency(detail.terms.totalSale) : undefined} />
                {detail.terms?.discount1 != null && detail.terms.discount1 > 0 && (
                  <DetailField
                    label={`Discount 1${detail.terms.discount1Label ? ` (${detail.terms.discount1Label})` : ""}`}
                    value={formatCurrency(detail.terms.discount1)}
                  />
                )}
                {detail.terms?.discount2 != null && detail.terms.discount2 > 0 && (
                  <DetailField
                    label={`Discount 2${detail.terms.discount2Label ? ` (${detail.terms.discount2Label})` : ""}`}
                    value={formatCurrency(detail.terms.discount2)}
                  />
                )}
                {detail.terms?.additionalSale1 != null && detail.terms.additionalSale1 > 0 && (
                  <DetailField
                    label={`Additional 1${detail.terms.additionalSale1Label ? ` (${detail.terms.additionalSale1Label})` : ""}`}
                    value={formatCurrency(detail.terms.additionalSale1)}
                  />
                )}
                {detail.terms?.additionalSale2 != null && detail.terms.additionalSale2 > 0 && (
                  <DetailField
                    label={`Additional 2${detail.terms.additionalSale2Label ? ` (${detail.terms.additionalSale2Label})` : ""}`}
                    value={formatCurrency(detail.terms.additionalSale2)}
                  />
                )}
                {detail.terms?.trade != null && detail.terms.trade > 0 && (
                  <DetailField label="Trade" value={formatCurrency(detail.terms.trade)} />
                )}
                <DetailField
                  label="Delivery Method"
                  value={detail.terms?.deliveryMethod}
                />
                <DetailField
                  label="Due Day"
                  value={detail.terms?.dueDayOfMonth ? `Day ${detail.terms.dueDayOfMonth} of month` : undefined}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="placements">
          <div className="pt-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Type</TableHead>
                    <TableHead>Edition</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Slots</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.adPurchases.map((ap) => (
                    <TableRow key={ap._id}>
                      <TableCell className="font-medium">
                        {ap.advertisementName}
                      </TableCell>
                      <TableCell>{ap.editionName}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ap.isDayType
                              ? "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300"
                              : "bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300"
                          }
                        >
                          {ap.isDayType ? "Day" : "Non-Day"}
                        </Badge>
                      </TableCell>
                      <TableCell>{ap.quantity}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {ap.slots.map((slot, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {slot.slotNumber
                                ? `${MONTHS[(slot.month ?? 1) - 1]} #${slot.slotNumber}`
                                : `${MONTHS[(slot.month ?? 1) - 1]}`}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {detail.adPurchases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No ad placements
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="pt-4">
            <ScheduledPaymentsTable
              scheduledPayments={detail.scheduledPayments}
            />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="pt-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Check #</TableHead>
                    <TableHead>Prepaid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.payments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="capitalize">
                        {payment.method?.replace("_", " ") ?? "—"}
                      </TableCell>
                      <TableCell>{payment.checkNumber ?? "—"}</TableCell>
                      <TableCell>
                        {payment.isPrepaid ? (
                          <Badge variant="outline">Yes</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {detail.payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No payments recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <RecordPaymentSheet
        open={paymentFormOpen}
        onOpenChange={setPaymentFormOpen}
        purchaseId={id}
        contactName={contactName}
        company={detail.contact?.company}
        invoiceNumber={detail.invoiceNumber}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Purchase"
        description={`Are you sure you want to delete invoice ${detail.invoiceNumber ?? "this purchase"}? This will permanently remove all payments, allocations, and slot assignments.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteLoading}
      />
    </div>
  );
}
