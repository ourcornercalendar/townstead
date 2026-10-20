"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
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
import { EmptyState } from "@/components/shared/empty-state";
import { ContactForm } from "../contact-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  ShoppingCart,
  CreditCard,
  FileText,
  Link2,
  Unlink,
  ImageIcon,
  Send,
  Copy,
  RefreshCw,
  XCircle,
  Info,
  Check,
  Clock,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { useOrg } from "@/hooks/use-org";
import { useStableNow } from "@/hooks/use-stable-now";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { PERMISSIONS, DEFAULT_CONTACT_PERMISSIONS } from "../../../../../convex/permissions";
import { AdStatusSelect } from "@/components/admin/ad-status";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | undefined | null;
}) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

const PORTAL_PERMISSION_OPTIONS = [
  { value: PERMISSIONS.PORTAL_VIEW, label: "View Portal Dashboard" },
  { value: PERMISSIONS.PORTAL_ASSETS, label: "Upload Ad Artwork" },
  { value: PERMISSIONS.PORTAL_MESSAGES, label: "Send & Receive Messages" },
  { value: PERMISSIONS.PORTAL_PAYMENTS, label: "View Payments" },
  { value: PERMISSIONS.PORTAL_INVOICES, label: "View Invoices" },
  { value: PERMISSIONS.PORTAL_PLACEMENTS, label: "View Ad Placements" },
  { value: PERMISSIONS.EVENTS_SUBMIT, label: "Submit Events" },
  { value: PERMISSIONS.EVENTS_UPDATE_OWN, label: "Edit Own Events" },
  { value: PERMISSIONS.BLOG_SUBMIT, label: "Submit Blog Posts" },
  { value: PERMISSIONS.BLOG_UPDATE_OWN, label: "Edit Own Blog Posts" },
];

function ContactDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"contacts">;
  const { orgId, isReady } = useOrg();
  const now = useStableNow();
  const contact = useQuery(
    api.contacts.queries.getById,
    isReady ? { id } : "skip"
  );
  const contactCategory = useQuery(
    api.categories.queries.getById,
    contact?.categoryId ? { id: contact.categoryId } : "skip"
  );
  const addressBooks = useQuery(
    api.addressBooks.queries.list,
    isReady ? { orgId: orgId! } : "skip"
  );
  const purchases = useQuery(
    api.purchases.queries.listByContact,
    isReady ? { contactId: id, now } : "skip"
  );
  const payments = useQuery(
    api.payments.queries.listByContact,
    isReady ? { contactId: id } : "skip"
  );
  const [formOpen, setFormOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [invitePermissions, setInvitePermissions] = useState<string[]>([
    ...DEFAULT_CONTACT_PERMISSIONS,
  ]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [clerkLookup, setClerkLookup] = useState<{
    found: boolean;
    userId?: string;
    name?: string;
    checked: boolean;
  }>({ found: false, checked: false });

  const clientGrant = useQuery(
    api.orgPermissions.queries.getForContact,
    isReady ? { contactId: id } : "skip"
  );
  const portalInvite = useQuery(
    api.portalInvites.queries.getByContact,
    isReady ? { contactId: id } : "skip"
  );
  const clientAssets = useQuery(
    api.clientAssets.queries.listByContact,
    isReady ? { contactId: id } : "skip"
  );

  const linkContact = useMutation(api.orgPermissions.mutations.linkContact);
  const unlinkContact = useMutation(api.orgPermissions.mutations.unlinkContact);
  const revokeInvite = useMutation(api.portalInvites.mutations.revoke);
  const reviewAsset = useMutation(api.clientAssets.mutations.review);

  const lookupClerkUser = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/portal/lookup?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setClerkLookup({ ...data, checked: true });
      } else {
        setClerkLookup({ found: false, checked: true });
      }
    } catch {
      setClerkLookup({ found: false, checked: true });
    }
  }, []);

  useEffect(() => {
    if (
      contact?.email &&
      clientGrant === null &&
      (portalInvite === null || portalInvite === undefined)
    ) {
      lookupClerkUser(contact.email);
    }
  }, [contact?.email, clientGrant, portalInvite, lookupClerkUser]);

  if (contact === undefined) {
    return <ContactDetailSkeleton />;
  }

  if (contact === null) {
    return (
      <div className="space-y-6">
        <Link href="/admin/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </Button>
        </Link>
        <EmptyState
          title="Contact not found"
          description="This contact may have been deleted."
        />
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const addressParts = [
    contact.address?.street,
    contact.address?.city,
    contact.address?.state,
    contact.address?.zip,
  ].filter(Boolean);
  const formattedAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

  const contactAddressBookNames = (contact.addressBookIds ?? [])
    .map((abId) => (addressBooks ?? []).find((ab) => ab._id === abId)?.name)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <PageHeader
        title={fullName}
        description={contact.company ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ad status</span>
            <AdStatusSelect
              contactId={contact._id}
              status={contact.adStatus}
            />
            <Button
              variant="outline"
              onClick={() => setFormOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="info">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="info" className="data-[state=active]:text-blue-700 data-[state=active]:dark:text-blue-400">Info</TabsTrigger>
            <TabsTrigger value="purchases" className="data-[state=active]:text-emerald-700 data-[state=active]:dark:text-emerald-400">Purchases</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:text-amber-700 data-[state=active]:dark:text-amber-400">Payments</TabsTrigger>
            <TabsTrigger value="portal" className="data-[state=active]:text-violet-700 data-[state=active]:dark:text-violet-400">Portal Access</TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=active]:text-rose-700 data-[state=active]:dark:text-rose-400">Assets</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <Card className="border-l-3 border-l-blue-500">
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DetailField label="First Name" value={contact.firstName} />
                <DetailField label="Last Name" value={contact.lastName} />
                <DetailField label="Company" value={contact.company} />
                <DetailField label="Email" value={contact.email} />
                <DetailField label="Phone" value={contact.phone} />
                <DetailField label="Website" value={contact.website} />
                <DetailField label="Category" value={contactCategory?.name} />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-l-3 border-l-emerald-500">
                <CardHeader>
                  <CardTitle>Address</CardTitle>
                </CardHeader>
                <CardContent>
                  {formattedAddress ? (
                    <p className="text-sm">{formattedAddress}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No address on file
                    </p>
                  )}
                </CardContent>
              </Card>

              {contactAddressBookNames.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Address Books</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contactAddressBookNames.map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {contact.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {contact.notes}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          <div className="pt-4">
            {purchases && purchases.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Edition</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase) => (
                      <TableRow
                        key={purchase._id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() =>
                          router.push(`/admin/purchases/${purchase._id}`)
                        }
                      >
                        <TableCell className="font-medium text-primary underline underline-offset-2 decoration-primary/30">
                          {purchase.invoiceNumber ?? "—"}
                        </TableCell>
                        <TableCell>{purchase.editionCode}</TableCell>
                        <TableCell>{purchase.year}</TableCell>
                        <TableCell>{formatCurrency(purchase.net)}</TableCell>
                        <TableCell>{formatCurrency(purchase.amountPaid)}</TableCell>
                        <TableCell>
                          {purchase.isPaid ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Paid
                            </Badge>
                          ) : purchase.amountPaid > 0 ? (
                            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                              Partial
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unpaid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title="Download statement"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/api/pdf/purchase-statement/${purchase._id}`, "_blank");
                              }}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground group-hover:text-primary">
                              View
                              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title="No purchases yet"
                description="No purchase records found for this contact."
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="pt-4">
            {payments && payments.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Edition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment._id}>
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="capitalize">
                          {payment.method?.replace("_", " ") ?? "—"}
                        </TableCell>
                        <TableCell>{payment.invoiceNumber ?? "—"}</TableCell>
                        <TableCell>
                          {payment.editionName} {payment.year}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No payments yet"
                description="No payment records found for this contact."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="portal">
          <div className="pt-4 space-y-4">
            <Card className="border-l-3 border-l-violet-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-violet-500" />
                  Client Portal Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {clientGrant ? (
                  /* STATE 3: Linked */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <Check className="mr-1 h-3 w-3" />
                        Portal Access Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">Linked Account</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {clientGrant.userId}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await unlinkContact({ id: clientGrant._id });
                        }}
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        Unlink
                      </Button>
                    </div>
                    {clientGrant.permissions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Active Permissions</p>
                        <div className="flex flex-wrap gap-1">
                          {clientGrant.permissions.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : portalInvite && portalInvite.status === "pending" ? (
                  /* STATE 2: Pending invite */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Clock className="mr-1 h-3 w-3" />
                        Invite Pending
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Sent {formatDate(portalInvite.createdAt)} &middot;
                        Expires {formatDate(portalInvite.expiresAt)}
                      </span>
                    </div>

                    {portalInvite.permissions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Invited Permissions</p>
                        <div className="flex flex-wrap gap-1">
                          {portalInvite.permissions.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const baseUrl = window.location.origin;
                          const url = `${baseUrl}/portal/invite/${portalInvite.token}`;
                          await navigator.clipboard.writeText(url);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        {copied ? "Copied" : "Copy Invite Link"}
                      </Button>

                      {contact.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              setInviteLoading(true);
                              await fetch("/api/portal/invite", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  contactId: id,
                                  permissions: portalInvite.permissions,
                                }),
                              });
                            } catch {
                              // silently handle
                            } finally {
                              setInviteLoading(false);
                            }
                          }}
                          disabled={inviteLoading}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${inviteLoading ? "animate-spin" : ""}`} />
                          Resend Email
                        </Button>
                      )}

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await revokeInvite({ id: portalInvite._id });
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Revoke Invite
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* STATE 1: No access, no pending invite */
                  <div className="space-y-4">
                    <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4">
                      <div className="flex gap-3">
                        <Info className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium">How Portal Access Works</p>
                          <p className="text-sm text-muted-foreground">
                            Portal access lets this contact sign in and view their ads, invoices,
                            and payments. Send a portal invite to generate a unique link.
                            The client can sign up with any email they choose and will be
                            automatically connected to this contact record.
                          </p>
                        </div>
                      </div>
                    </div>

                    {clerkLookup.checked && clerkLookup.found && (
                      <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3 items-center">
                            <Shield className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">
                                Existing account found for {contact.email}
                              </p>
                              {clerkLookup.name && (
                                <p className="text-xs text-muted-foreground">
                                  {clerkLookup.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (clientGrant) return;
                              try {
                                await linkContact({
                                  userId: clerkLookup.userId!,
                                  contactId: id,
                                });
                                toast.success("Client account linked successfully");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to link"
                                );
                              }
                            }}
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Link Now
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button onClick={() => {
                      setInviteDialogOpen(true);
                      setInviteResult(null);
                      setInvitePermissions([...DEFAULT_CONTACT_PERMISSIONS]);
                    }}>
                      <Send className="mr-2 h-4 w-4" />
                      Send Portal Invite
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets">
          <div className="pt-4">
            {clientAssets && clientAssets.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientAssets.map((asset) => (
                      <TableRow key={asset._id}>
                        <TableCell className="font-medium">
                          {asset.fileName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              asset.status === "approved"
                                ? "default"
                                : asset.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              asset.status === "approved"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : undefined
                            }
                          >
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {asset.feedback ?? "—"}
                        </TableCell>
                        <TableCell>
                          {(asset.status === "uploaded" ||
                            asset.status === "under_review") && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  reviewAsset({
                                    id: asset._id,
                                    status: "approved",
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const fb = prompt("Rejection reason:");
                                  if (fb !== null) {
                                    reviewAsset({
                                      id: asset._id,
                                      status: "rejected",
                                      feedback: fb || undefined,
                                    });
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={ImageIcon}
                title="No assets uploaded"
                description="Client-uploaded ad artwork will appear here."
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Portal Invite</DialogTitle>
          </DialogHeader>
          {inviteResult ? (
            <div className="space-y-4">
              <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 text-center space-y-2">
                <Check className="mx-auto h-8 w-8 text-green-600" />
                <p className="text-sm font-medium">Invite Created</p>
                {inviteResult.emailSent && (
                  <p className="text-xs text-muted-foreground">
                    Email sent to {contact.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Invite Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteResult.inviteUrl}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteResult.inviteUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {!inviteResult.emailSent && (
                  <p className="text-xs text-muted-foreground">
                    No email on file. Share this link manually with the client.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setInviteDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {contact.email
                    ? <>An invite will be sent to <strong>{contact.email}</strong>. The client can sign up with any email they choose.</>
                    : <>No email on file. You&apos;ll get a link to share manually.</>}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-violet-500" />
                  Portal Permissions
                </Label>
                <div className="grid gap-2 rounded-md border p-3 max-h-52 overflow-y-auto">
                  {PORTAL_PERMISSION_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={invitePermissions.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          setInvitePermissions((prev) =>
                            checked
                              ? [...prev, opt.value]
                              : prev.filter((p) => p !== opt.value)
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={inviteLoading}
                  onClick={async () => {
                    try {
                      setInviteLoading(true);
                      const res = await fetch("/api/portal/invite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          contactId: id,
                          permissions: invitePermissions,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        alert(data.error ?? "Failed to create invite");
                        return;
                      }
                      setInviteResult({
                        inviteUrl: data.inviteUrl,
                        emailSent: data.emailSent,
                      });
                    } catch (err) {
                      alert(
                        err instanceof Error
                          ? err.message
                          : "Failed to send invite"
                      );
                    } finally {
                      setInviteLoading(false);
                    }
                  }}
                >
                  {inviteLoading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Invite
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={contact as Doc<"contacts">}
        addressBooks={addressBooks ?? []}
      />
    </div>
  );
}
