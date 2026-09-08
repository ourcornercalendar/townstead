import { z } from "zod";

export const calendarEditionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  communityId: z.string().optional(),
});

export const advertisementSchema = z.object({
  name: z.string().min(1, "Name is required"),
  isDayType: z.boolean(),
  slotsPerMonth: z.number().int().min(0, "Must be 0 or more"),
});

export const monthlyPricesSchema = z.object({
  jan: z.number().min(0),
  feb: z.number().min(0),
  mar: z.number().min(0),
  apr: z.number().min(0),
  may: z.number().min(0),
  jun: z.number().min(0),
  jul: z.number().min(0),
  aug: z.number().min(0),
  sep: z.number().min(0),
  oct: z.number().min(0),
  nov: z.number().min(0),
  dec: z.number().min(0),
});

export const adPricingSchema = z.object({
  advertisementId: z.string().min(1, "Advertisement is required"),
  calendarEditionId: z.string().min(1, "Calendar edition is required"),
  year: z.number().int().min(2000).max(2100),
  monthlyPrices: monthlyPricesSchema,
});

export const addressSchema = z.object({
  street: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
});

export const contactSchema = z.object({
  company: z.string().min(1, "Company is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  salutation: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  cellPhone: z.string().optional(),
  fax: z.string().optional(),
  altPhone: z.string().optional(),
  altContactFirstName: z.string().optional(),
  altContactLastName: z.string().optional(),
  address: addressSchema.optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  customerSince: z.number().optional(),
  addressBookIds: z.array(z.string()).optional(),
  showOnWebsite: z.boolean().optional(),
});

export const purchaseSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  calendarEditionIds: z.array(z.string()).min(1, "At least one calendar edition is required"),
  year: z.number().int().min(2000).max(2100),
});

export const paymentTermsSchema = z.object({
  totalSale: z.number().min(0, "Total sale must be positive"),
  discount1: z.number().min(0).optional(),
  discount1Label: z.string().optional(),
  discount2: z.number().min(0).optional(),
  discount2Label: z.string().optional(),
  additionalSale1: z.number().min(0).optional(),
  additionalSale1Label: z.string().optional(),
  additionalSale2: z.number().min(0).optional(),
  additionalSale2Label: z.string().optional(),
  trade: z.number().min(0).optional(),
  earlyDiscountType: z.enum(["flat", "percent"]).optional(),
  earlyDiscountAmount: z.number().min(0).optional(),
  lateFeeType: z.enum(["flat", "percent"]).optional(),
  lateFeeAmount: z.number().min(0).optional(),
  dueDayOfMonth: z.number().int().min(1).max(31).optional(),
  splitEqually: z.boolean().optional(),
  scheduleStartMonth: z.number().int().min(1).max(12).optional(),
  scheduleStartYear: z.number().int().min(2000).max(2100).optional(),
  scheduleEndMonth: z.number().int().min(1).max(12).optional(),
  scheduleEndYear: z.number().int().min(2000).max(2100).optional(),
  customSchedule: z
    .array(
      z.object({
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(2000).max(2100),
        amount: z.number().min(0),
      })
    )
    .optional(),
  deliveryMethod: z.string().optional(),
  invoiceMessage: z.string().optional(),
  statementMessage: z.string().optional(),
});

export const paymentSchema = z.object({
  purchaseId: z.string().min(1, "Purchase is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  date: z.number(),
  method: z.string().optional(),
  checkNumber: z.string().optional(),
  isPrepaid: z.boolean().optional(),
});

export const eventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  date: z.number(),
  endDate: z.number().optional(),
  // Times are no longer collected on the admin event form -- they were never
  // printed on the calendar. They stay in the schema and on the public
  // submission form, where a member of the public can still give one and the
  // website still shows it.
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  printPlacement: z.enum(["TOP", "MIDDLE", "BOTTOM"]).optional(),
  isScusd: z.boolean().optional(),
  isYearly: z.boolean().optional(),
  scheduleType: z
    .enum([
      "SINGLE_DAY",
      "DAILY_RANGE",
      "MONTHLY_DAY",
      "MONTHLY_ORDINAL_WEEKDAY",
    ])
    .optional(),
  startsOn: z.number().optional(),
  endsOn: z.number().optional(),
  monthlyOrdinal: z
    .enum([
      "EVERY",
      "EVERY_OTHER",
      "SECOND_AND_FOURTH",
      "FIRST_THIRD_AND_FIFTH",
      "FIRST",
      "SECOND",
      "THIRD",
      "FOURTH",
      "LAST",
    ])
    .optional(),
  monthlyWeekday: z
    .enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ])
    .optional(),
  monthlyMonthSelector: z.enum(["EVERY", "EVEN", "ODD"]).optional(),
  calendarEditionIds: z.array(z.string()).optional(),
}).superRefine((value, ctx) => {
  const scheduleType = value.scheduleType ?? "SINGLE_DAY";
  if (!value.startsOn) {
    ctx.addIssue({
      code: "custom",
      path: ["startsOn"],
      message: "Date is required",
    });
  }
  if (scheduleType !== "SINGLE_DAY" && !value.endsOn && !value.endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "End date is required for repeating events",
    });
  }
  if (
    value.startsOn &&
    value.endsOn &&
    scheduleType !== "SINGLE_DAY" &&
    value.endsOn < value.startsOn
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "End date must be on or after the start date",
    });
  }
  if (
    (scheduleType === "MONTHLY_DAY" ||
      scheduleType === "MONTHLY_ORDINAL_WEEKDAY") &&
    !value.monthlyOrdinal
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["monthlyOrdinal"],
      message: "Repeat option is required",
    });
  }
  if (scheduleType === "MONTHLY_ORDINAL_WEEKDAY") {
    if (!value.monthlyWeekday) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyWeekday"],
        message: "Weekday is required",
      });
    }
    if (!value.monthlyMonthSelector) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyMonthSelector"],
        message: "Month selector is required",
      });
    }
  }
});

export const addressBookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  displayLevel: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["event", "blog", "video", "business"] as const, {
    message: "Type is required",
  }),
});

// Type inference helpers
export type CalendarEditionFormValues = z.infer<typeof calendarEditionSchema>;
export type AdvertisementFormValues = z.infer<typeof advertisementSchema>;
export type ContactFormValues = z.infer<typeof contactSchema>;
export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
export type PaymentTermsFormValues = z.infer<typeof paymentTermsSchema>;
export type PaymentFormValues = z.infer<typeof paymentSchema>;
export type EventFormValues = z.infer<typeof eventSchema>;
export type AddressBookFormValues = z.infer<typeof addressBookSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
