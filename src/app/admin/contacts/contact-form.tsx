"use client";

import { useForm, type ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { contactSchema, type ContactFormValues } from "@/lib/validators";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ImageUpload } from "@/components/shared/image-upload";
import { toast } from "sonner";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

function timestampToDateString(ts: number | undefined): string {
  if (!ts) return "";
  return new Date(ts).toISOString().split("T")[0];
}

function dateStringToTimestamp(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/** Base UI PopoverTrigger uses `render`, not Radix `asChild`; the latter leaves a wrapper button around the custom control. */
export function ContactCategoryCombobox({
  field,
  categoryOpen,
  onCategoryOpenChange,
  categoryMap,
  businessCategories,
}: {
  field: ControllerRenderProps<ContactFormValues, "categoryId">;
  categoryOpen: boolean;
  onCategoryOpenChange: (open: boolean) => void;
  categoryMap: Map<string, string>;
  businessCategories: Doc<"categories">[] | undefined;
}) {
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField();
  const ariaDescribedBy = !error
    ? formDescriptionId
    : `${formDescriptionId} ${formMessageId}`;

  return (
    <Popover open={categoryOpen} onOpenChange={onCategoryOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={formItemId}
            aria-describedby={ariaDescribedBy}
            aria-invalid={!!error}
            variant="outline"
            role="combobox"
            aria-expanded={categoryOpen}
            className={cn(
              "w-full justify-between font-normal",
              !field.value && "text-muted-foreground"
            )}
          >
            {field.value
              ? categoryMap.get(field.value) ?? "Select category..."
              : "Select category..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  field.onChange("");
                  onCategoryOpenChange(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !field.value ? "opacity-100" : "opacity-0"
                  )}
                />
                None
              </CommandItem>
              {businessCategories?.map((cat) => (
                <CommandItem
                  key={cat._id}
                  value={cat.name}
                  onSelect={() => {
                    field.onChange(cat._id);
                    onCategoryOpenChange(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      field.value === cat._id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Doc<"contacts"> | null;
  addressBooks: Doc<"addressBooks">[];
}

export function ContactForm({
  open,
  onOpenChange,
  editing,
  addressBooks,
}: ContactFormProps) {
  const { orgId } = useOrg();
  const create = useMutation(api.contacts.mutations.create);
  const update = useMutation(api.contacts.mutations.update);
  const generateUploadUrl = useMutation(api.contacts.mutations.generateUploadUrl);
  const businessCategories = useQuery(
    api.categories.queries.list,
    orgId ? { orgId, type: "business" as const } : "skip"
  );
  const [isPending, setIsPending] = useState(false);
  const [logoFileId, setLogoFileId] = useState<Id<"_storage"> | undefined>();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const categoryMap = useMemo(() => {
    if (!businessCategories) return new Map<string, string>();
    return new Map(businessCategories.map((c) => [c._id, c.name]));
  }, [businessCategories]);

  const existingLogoUrl = useQuery(
    api.storage.getUrl,
    logoFileId ? { storageId: logoFileId } : "skip"
  );

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      company: "",
      salutation: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      cellPhone: "",
      fax: "",
      altPhone: "",
      altContactFirstName: "",
      altContactLastName: "",
      address: {
        street: "",
        street2: "",
        city: "",
        state: "",
        zip: "",
        country: "",
      },
      website: "",
      categoryId: "",
      notes: "",
      customerSince: undefined,
      addressBookIds: [],
      showOnWebsite: false,
    },
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        company: editing.company ?? "",
        salutation: editing.salutation ?? "",
        firstName: editing.firstName,
        lastName: editing.lastName,
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        cellPhone: editing.cellPhone ?? "",
        fax: editing.fax ?? "",
        altPhone: editing.altPhone ?? "",
        altContactFirstName: editing.altContactFirstName ?? "",
        altContactLastName: editing.altContactLastName ?? "",
        address: {
          street: editing.address?.street ?? "",
          street2: editing.address?.street2 ?? "",
          city: editing.address?.city ?? "",
          state: editing.address?.state ?? "",
          zip: editing.address?.zip ?? "",
          country: editing.address?.country ?? "",
        },
        website: editing.website ?? "",
        categoryId: (editing.categoryId as string) ?? "",
        notes: editing.notes ?? "",
        customerSince: editing.customerSince,
        addressBookIds: (editing.addressBookIds as string[]) ?? [],
        showOnWebsite: editing.showOnWebsite ?? false,
      });
      setLogoFileId(editing.logoFileId ?? undefined);
    } else {
      form.reset({
        company: "",
        salutation: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        cellPhone: "",
        fax: "",
        altPhone: "",
        altContactFirstName: "",
        altContactLastName: "",
        address: {
          street: "",
          street2: "",
          city: "",
          state: "",
          zip: "",
          country: "",
        },
        website: "",
        categoryId: "",
        notes: "",
        customerSince: undefined,
        addressBookIds: [],
        showOnWebsite: false,
      });
      setLogoFileId(undefined);
    }
  }, [editing, form]);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      setUploadingLogo(true);
      try {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        setLogoFileId(storageId as Id<"_storage">);
      } catch {
        toast.error("Failed to upload logo");
      } finally {
        setUploadingLogo(false);
      }
    },
    [generateUploadUrl]
  );

  const onSubmit = async (values: ContactFormValues) => {
    if (!orgId) return;
    setIsPending(true);
    try {
      const address =
        values.address &&
        (values.address.street ||
          values.address.street2 ||
          values.address.city ||
          values.address.state ||
          values.address.zip ||
          values.address.country)
          ? values.address
          : undefined;

      const payload = {
        company: values.company,
        salutation: values.salutation || undefined,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        cellPhone: values.cellPhone || undefined,
        fax: values.fax || undefined,
        altPhone: values.altPhone || undefined,
        altContactFirstName: values.altContactFirstName || undefined,
        altContactLastName: values.altContactLastName || undefined,
        address,
        website: values.website || undefined,
        categoryId: values.categoryId
          ? (values.categoryId as Id<"categories">)
          : undefined,
        notes: values.notes || undefined,
        customerSince: values.customerSince,
        addressBookIds:
          values.addressBookIds && values.addressBookIds.length > 0
            ? (values.addressBookIds as Id<"addressBooks">[])
            : undefined,
        showOnWebsite: values.showOnWebsite ?? false,
        logoFileId,
      };

      if (editing) {
        await update({ id: editing._id, ...payload });
      } else {
        await create({ orgId, ...payload });
      }
      toast.success("Contact saved");
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error("Failed to save contact");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit" : "New"} Contact</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6 px-4"
          >
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Basic Info
              </h3>
              <div className="space-y-1">
                <Label>Company Logo</Label>
                <ImageUpload
                  preset="logo"
                  onUpload={handleLogoUpload}
                  onRemove={() => setLogoFileId(undefined)}
                  currentImageUrl={existingLogoUrl ?? null}
                  uploading={uploadingLogo}
                />
              </div>
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salutation"
                render={({ field }) => (
                  <FormItem className="max-w-40">
                    <FormLabel>Salutation</FormLabel>
                    <FormControl>
                      <Input placeholder="Mr., Ms., Dr." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="customerSince"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Since</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={timestampToDateString(field.value)}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? dateStringToTimestamp(e.target.value)
                              : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cellPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cell Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Cell" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fax</FormLabel>
                      <FormControl>
                        <Input placeholder="Fax" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="altPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alt Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Alternate phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Alt Contact
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="altContactFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="altContactLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Category</FormLabel>
                    <ContactCategoryCombobox
                      field={field}
                      categoryOpen={categoryOpen}
                      onCategoryOpenChange={setCategoryOpen}
                      categoryMap={categoryMap}
                      businessCategories={businessCategories}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/*
                Whether this advertiser belongs in the public business
                directory on ourcornercalendar.com.

                Off by default, and deliberately so: this contact list is a
                sales list built over years, and most of it is prospects and
                lapsed customers. Ticking this is Joyce saying "this one is
                current", which is a judgement no rule in the data can make
                for her.

                Ticking it sends the business across hidden -- it still has
                to be published on the website. Unticking it takes it back
                off public view without deleting anything written there.
              */}
              <FormField
                control={form.control}
                name="showOnWebsite"
                render={({ field }) => (
                  <FormItem className="rounded-md border p-4">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          id="showOnWebsite"
                          checked={field.value ?? false}
                          onCheckedChange={(val) => field.onChange(val === true)}
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <Label htmlFor="showOnWebsite" className="font-medium">
                          Show in the business directory on ourcornercalendar.com
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {field.value
                            ? "This business is sent to the website. It arrives hidden — publish it there when the listing looks right."
                            : "Leave this off for prospects and past customers. They stay in your records here and never reach the website."}
                        </p>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Address
              </h3>
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.street2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Suite, unit, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address.zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {addressBooks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Address Books
                  </h3>
                  <FormField
                    control={form.control}
                    name="addressBookIds"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-2">
                          {addressBooks.map((ab) => {
                            const checked = (field.value ?? []).includes(
                              ab._id
                            );
                            return (
                              <div
                                key={ab._id}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  id={ab._id}
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    const current = field.value ?? [];
                                    if (val) {
                                      field.onChange([...current, ab._id]);
                                    } else {
                                      field.onChange(
                                        current.filter(
                                          (id: string) => id !== ab._id
                                        )
                                      );
                                    }
                                  }}
                                />
                                <Label htmlFor={ab._id}>{ab.name}</Label>
                              </div>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <SheetFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Saving..." : "Save Contact"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
