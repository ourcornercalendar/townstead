"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Shield, ChevronRight, Users } from "lucide-react";
import { useDefaultYear } from "@/hooks/use-default-year";

const currentYear = new Date().getFullYear();
const defaultYearOptions = Array.from(
  { length: 10 },
  (_, i) => currentYear - 2 + i
);

const orgSettingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  publisherName: z.string().optional(),
  remitToName: z.string().optional(),
  remitToAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }),
  showCreditCardSection: z.boolean(),
  nsfFeeAmount: z.coerce.number().int().min(0).optional(),
});

type OrgSettingsFormValues = z.infer<typeof orgSettingsSchema>;

const defaultValues: OrgSettingsFormValues = {
  businessName: "",
  address: { street: "", city: "", state: "", zip: "" },
  phone: "",
  email: "",
  publisherName: "",
  remitToName: "",
  remitToAddress: { street: "", city: "", state: "", zip: "" },
  showCreditCardSection: true,
  nsfFeeAmount: 2500,
};

export default function SettingsPage() {
  const { orgId, isReady } = useOrg();
  const { defaultYear, setDefaultYear } = useDefaultYear();
  const settings = useQuery(
    api.settings.queries.getOrgSettings,
    isReady ? { orgId: orgId! } : "skip"
  );
  const upsert = useMutation(api.settings.mutations.upsertOrgSettings);

  const form = useForm<OrgSettingsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(orgSettingsSchema) as any,
    defaultValues,
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        businessName: settings.businessName,
        address: {
          street: settings.address?.street ?? "",
          city: settings.address?.city ?? "",
          state: settings.address?.state ?? "",
          zip: settings.address?.zip ?? "",
        },
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        publisherName: settings.publisherName ?? "",
        remitToName: settings.remitToName ?? "",
        remitToAddress: {
          street: settings.remitToAddress?.street ?? "",
          city: settings.remitToAddress?.city ?? "",
          state: settings.remitToAddress?.state ?? "",
          zip: settings.remitToAddress?.zip ?? "",
        },
        showCreditCardSection: settings.showCreditCardSection ?? true,
        nsfFeeAmount: settings.nsfFeeAmount ?? 2500,
      });
    }
  }, [settings, form]);

  if (!isReady || settings === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization&apos;s invoice and billing settings.
          </p>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const onSubmit = async (values: OrgSettingsFormValues) => {
    try {
      const addr = values.address;
      const hasAddress = addr.street || addr.city || addr.state || addr.zip;
      const remit = values.remitToAddress;
      const hasRemit = remit.street || remit.city || remit.state || remit.zip;

      await upsert({
        orgId: orgId!,
        businessName: values.businessName,
        address: hasAddress ? addr : undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        publisherName: values.publisherName || undefined,
        remitToName: values.remitToName || undefined,
        remitToAddress: hasRemit ? remit : undefined,
        showCreditCardSection: values.showCreditCardSection,
        nsfFeeAmount: values.nsfFeeAmount,
      });
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization&apos;s invoice and billing settings.
        </p>
      </div>

      <Link href="/admin/settings/team" className="block group">
        <Card className="border-l-3 border-l-violet-500 transition-colors group-hover:bg-muted/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-violet-500" />
                <div>
                  <CardTitle>Team</CardTitle>
                  <CardDescription>
                    Let someone add events without giving them the rest of the
                    business.
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/admin/settings/permissions" className="block group">
        <Card className="border-l-3 border-l-indigo-500 transition-colors group-hover:bg-muted/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-indigo-500" />
                <div>
                  <CardTitle>Permissions</CardTitle>
                  <CardDescription>
                    Configure default permissions for contacts and public users.
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Card className="border-l-3 border-l-blue-500">
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
          <CardDescription>
            Controls the default edition year filter across all admin pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label
              htmlFor="default-year"
              className="text-sm font-medium whitespace-nowrap"
            >
              Default Edition Year
            </label>
            <Select
              value={String(defaultYear)}
              onValueChange={(val) => val != null && setDefaultYear(parseInt(val, 10))}
            >
              <SelectTrigger id="default-year" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultYearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-l-3 border-l-emerald-500">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Appears in the header of invoices and statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Publishing Concepts LLC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="publisherName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Publisher Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Joyce Nazabal" {...field} />
                    </FormControl>
                    <FormDescription>
                      Shown on invoices as &quot;Publisher: ...&quot;
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="P.O. Box 188" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Elk Grove" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="CA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP</FormLabel>
                      <FormControl>
                        <Input placeholder="95759" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="916-217-0106" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="joyce@metrocalendars.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-l-3 border-l-amber-500">
            <CardHeader>
              <CardTitle>Remit-To Address</CardTitle>
              <CardDescription>
                Printed on the tear-off section of invoices and statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="remitToName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Payable To</FormLabel>
                    <FormControl>
                      <Input placeholder="Town Planner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remitToAddress.street"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Street</FormLabel>
                    <FormControl>
                      <Input placeholder="P.O. Box 188" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remitToAddress.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Elk Grove" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="remitToAddress.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="CA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="remitToAddress.zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP</FormLabel>
                      <FormControl>
                        <Input placeholder="95759" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-3 border-l-violet-500">
            <CardHeader>
              <CardTitle>Invoice Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="showCreditCardSection"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Credit Card Section
                      </FormLabel>
                      <FormDescription>
                        Show blank credit card payment fields on the tear-off.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nsfFeeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NSF Fee (in cents)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="2500"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormDescription>
                      Default: 2500 ($25.00). Mentioned in the invoice footer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
