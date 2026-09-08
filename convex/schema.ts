import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  calendarEditions: defineTable({
    name: v.string(),
    code: v.string(),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_code", ["orgId", "code"]),

  advertisements: defineTable({
    name: v.string(),
    isDayType: v.boolean(),
    slotsPerMonth: v.number(),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  }).index("by_orgId", ["orgId"]),

  adPricing: defineTable({
    advertisementId: v.id("advertisements"),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
    monthlyPrices: v.object({
      jan: v.number(),
      feb: v.number(),
      mar: v.number(),
      apr: v.number(),
      may: v.number(),
      jun: v.number(),
      jul: v.number(),
      aug: v.number(),
      sep: v.number(),
      oct: v.number(),
      nov: v.number(),
      dec: v.number(),
    }),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_calendarEditionId", ["orgId", "calendarEditionId"])
    .index("by_advertisementId", ["advertisementId"])
    .index("by_advertisementId_and_calendarEditionId_and_year", [
      "advertisementId",
      "calendarEditionId",
      "year",
    ]),

  contacts: defineTable({
    company: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    salutation: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    cellPhone: v.optional(v.string()),
    fax: v.optional(v.string()),
    altPhone: v.optional(v.string()),
    altContactFirstName: v.optional(v.string()),
    altContactLastName: v.optional(v.string()),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        street2: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zip: v.optional(v.string()),
        country: v.optional(v.string()),
      })
    ),
    website: v.optional(v.string()),
    category: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    notes: v.optional(v.string()),
    customerSince: v.optional(v.number()),
    addressBookIds: v.optional(v.array(v.id("addressBooks"))),
    searchText: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    logoFileId: v.optional(v.id("_storage")),
    featured: v.optional(v.boolean()),
    // Joyce's decision that this advertiser belongs in the public business
    // directory on ourcornercalendar.com. Absent means no: the contact list is
    // a sales list going back years, and most of it is prospects and lapsed
    // customers who should not appear on the website.
    showOnWebsite: v.optional(v.boolean()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_email", ["orgId", "email"])
    .index("by_orgId_and_slug", ["orgId", "slug"])
    .searchIndex("search_contacts", {
      searchField: "searchText",
      filterFields: ["orgId", "isDeleted"],
    }),

  addressBooks: defineTable({
    name: v.string(),
    displayLevel: v.optional(v.string()),
    orgId: v.string(),
  }).index("by_orgId", ["orgId"]),

  purchases: defineTable({
    contactId: v.id("contacts"),
    calendarEditionIds: v.array(v.id("calendarEditions")),
    year: v.number(),
    invoiceNumber: v.optional(v.string()),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
    hasSubmittedArtwork: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_year", ["orgId", "year"])
    .index("by_contactId", ["contactId"])
    .index("by_orgId_and_invoiceNumber", ["orgId", "invoiceNumber"]),

  paymentTerms: defineTable({
    purchaseId: v.id("purchases"),
    totalSale: v.number(),
    discount1: v.optional(v.number()),
    discount1Label: v.optional(v.string()),
    discount2: v.optional(v.number()),
    discount2Label: v.optional(v.string()),
    additionalSale1: v.optional(v.number()),
    additionalSale1Label: v.optional(v.string()),
    additionalSale2: v.optional(v.number()),
    additionalSale2Label: v.optional(v.string()),
    trade: v.optional(v.number()),
    earlyDiscountType: v.optional(v.union(v.literal("flat"), v.literal("percent"))),
    earlyDiscountAmount: v.optional(v.number()),
    lateFeeType: v.optional(v.union(v.literal("flat"), v.literal("percent"))),
    lateFeeAmount: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    splitEqually: v.optional(v.boolean()),
    scheduleStartMonth: v.optional(v.number()),
    scheduleStartYear: v.optional(v.number()),
    scheduleEndMonth: v.optional(v.number()),
    scheduleEndYear: v.optional(v.number()),
    customSchedule: v.optional(
      v.array(
        v.object({
          month: v.number(),
          year: v.number(),
          amount: v.number(),
        })
      )
    ),
    deliveryMethod: v.optional(v.string()),
    invoiceMessage: v.optional(v.string()),
    statementMessage: v.optional(v.string()),
    orgId: v.string(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_purchaseId", ["purchaseId"]),

  adPurchases: defineTable({
    purchaseId: v.id("purchases"),
    advertisementId: v.id("advertisements"),
    calendarEditionId: v.id("calendarEditions"),
    quantity: v.number(),
    charge: v.optional(v.number()),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_purchaseId", ["purchaseId"])
    .index("by_advertisementId", ["advertisementId"])
    .index("by_purchaseId_and_calendarEditionId", ["purchaseId", "calendarEditionId"]),

  adSlots: defineTable({
    adPurchaseId: v.id("adPurchases"),
    advertisementId: v.id("advertisements"),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
    month: v.number(),
    slotNumber: v.optional(v.number()),
    date: v.optional(v.number()),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_adPurchaseId", ["adPurchaseId"])
    .index("by_calendarEdition_year_month", [
      "calendarEditionId",
      "year",
      "month",
    ])
    .index("by_calendarEdition_year_month_advertisement", [
      "calendarEditionId",
      "year",
      "month",
      "advertisementId",
    ]),

  scheduledPayments: defineTable({
    purchaseId: v.id("purchases"),
    dueDate: v.number(),
    amount: v.number(),
    month: v.number(),
    year: v.number(),
    lateFeeWaived: v.optional(v.boolean()),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_purchaseId", ["purchaseId"])
    .index("by_orgId_and_year", ["orgId", "year"])
    .index("by_orgId_and_dueDate", ["orgId", "dueDate"]),

  payments: defineTable({
    purchaseId: v.id("purchases"),
    amount: v.number(),
    date: v.number(),
    method: v.optional(v.string()),
    checkNumber: v.optional(v.string()),
    isPrepaid: v.optional(v.boolean()),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_purchaseId", ["purchaseId"])
    .index("by_orgId_and_date", ["orgId", "date"]),

  paymentAllocations: defineTable({
    paymentId: v.id("payments"),
    scheduledPaymentId: v.id("scheduledPayments"),
    amount: v.number(),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_paymentId", ["paymentId"])
    .index("by_scheduledPaymentId", ["scheduledPaymentId"]),

  communities: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageFileId: v.optional(v.id("_storage")),
    calendarEditionIds: v.array(v.id("calendarEditions")),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_slug", ["orgId", "slug"]),

  events: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    endDate: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isYearly: v.optional(v.boolean()),
    scheduleType: v.optional(
      v.union(
        v.literal("SINGLE_DAY"),
        v.literal("DAILY_RANGE"),
        v.literal("MONTHLY_DAY"),
        v.literal("MONTHLY_ORDINAL_WEEKDAY")
      )
    ),
    startsOn: v.optional(v.number()),
    endsOn: v.optional(v.number()),
    monthlyOrdinal: v.optional(
      v.union(
        v.literal("EVERY"),
        v.literal("EVERY_OTHER"),
        v.literal("SECOND_AND_FOURTH"),
        v.literal("FIRST_THIRD_AND_FIFTH"),
        v.literal("FIRST"),
        v.literal("SECOND"),
        v.literal("THIRD"),
        v.literal("FOURTH"),
        v.literal("LAST")
      )
    ),
    monthlyWeekday: v.optional(
      v.union(
        v.literal("MONDAY"),
        v.literal("TUESDAY"),
        v.literal("WEDNESDAY"),
        v.literal("THURSDAY"),
        v.literal("FRIDAY"),
        v.literal("SATURDAY"),
        v.literal("SUNDAY")
      )
    ),
    monthlyMonthSelector: v.optional(
      v.union(v.literal("EVERY"), v.literal("EVEN"), v.literal("ODD"))
    ),
    calendarEditionIds: v.optional(v.array(v.id("calendarEditions"))),
    // Deprecated — kept as optional to allow schema push against legacy docs.
    // Run `events.migration.migrateCommunityIdsToEditions` to backfill and
    // clear, then this field can be removed.
    communityIds: v.optional(v.array(v.id("communities"))),
    location: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    categoryId: v.optional(v.id("categories")),
    imageFileId: v.optional(v.id("_storage")),
    isApproved: v.optional(v.boolean()),
    submittedBy: v.optional(v.string()),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_date", ["orgId", "date"]),

  tenantBranding: defineTable({
    orgId: v.string(),
    orgSlug: v.string(),
    logo: v.optional(v.id("_storage")),
    heroImage: v.optional(v.id("_storage")),
    primaryColor: v.optional(v.string()),
    siteName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    socialLinks: v.optional(
      v.object({
        facebook: v.optional(v.string()),
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        youtube: v.optional(v.string()),
      })
    ),
    footerText: v.optional(v.string()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgSlug", ["orgSlug"]),

  categories: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("event"),
      v.literal("blog"),
      v.literal("video"),
      v.literal("business")
    ),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_type", ["orgId", "type"]),

  coupons: defineTable({
    businessContactId: v.id("contacts"),
    title: v.string(),
    description: v.optional(v.string()),
    imageFileId: v.optional(v.id("_storage")),
    startDate: v.number(),
    endDate: v.number(),
    quantityLimit: v.optional(v.number()),
    perUserLimit: v.optional(v.number()),
    terms: v.optional(v.string()),
    communityIds: v.optional(v.array(v.id("communities"))),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_businessContactId", ["businessContactId"]),

  couponClaims: defineTable({
    couponId: v.id("coupons"),
    userId: v.string(),
    claimedAt: v.number(),
  })
    .index("by_couponId", ["couponId"])
    .index("by_userId", ["userId"])
    .index("by_couponId_and_userId", ["couponId", "userId"]),

  blogPosts: defineTable({
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    featuredImageFileId: v.optional(v.id("_storage")),
    authorId: v.optional(v.string()),
    categoryIds: v.optional(v.array(v.id("categories"))),
    communityIds: v.optional(v.array(v.id("communities"))),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("published")
    ),
    publishedAt: v.optional(v.number()),
    submittedBy: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_slug", ["orgId", "slug"])
    .index("by_orgId_and_status", ["orgId", "status"])
    .searchIndex("search_blog", {
      searchField: "title",
      filterFields: ["orgId", "status"],
    }),

  videos: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    businessContactId: v.optional(v.id("contacts")),
    categoryId: v.optional(v.id("categories")),
    communityIds: v.optional(v.array(v.id("communities"))),
    isApproved: v.optional(v.boolean()),
    submittedBy: v.optional(v.string()),
    orgId: v.string(),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_businessContactId", ["businessContactId"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  orgPermissions: defineTable({
    userId: v.string(),
    orgId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("contact"),
      v.literal("user")
    ),
    permissions: v.array(v.string()),
    contactId: v.optional(v.id("contacts")),
    isActive: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_orgId", ["orgId"])
    .index("by_userId_and_orgId", ["userId", "orgId"])
    .index("by_contactId", ["contactId"]),

  orgPermissionDefaults: defineTable({
    orgId: v.string(),
    contactDefaults: v.array(v.string()),
    userDefaults: v.array(v.string()),
  }).index("by_orgId", ["orgId"]),

  portalInvites: defineTable({
    contactId: v.id("contacts"),
    orgId: v.string(),
    token: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("redeemed"),
      v.literal("revoked"),
      v.literal("expired")
    ),
    redeemedByUserId: v.optional(v.string()),
    redeemedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_contactId", ["contactId"])
    .index("by_orgId", ["orgId"]),

  clientLinks: defineTable({
    userId: v.string(),
    contactId: v.id("contacts"),
    orgId: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_contactId", ["contactId"])
    .index("by_orgId", ["orgId"]),

  clientAssets: defineTable({
    contactId: v.id("contacts"),
    purchaseId: v.optional(v.id("purchases")),
    fileId: v.id("_storage"),
    fileName: v.string(),
    status: v.union(
      v.literal("uploaded"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    feedback: v.optional(v.string()),
    orgId: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_contactId", ["contactId"]),

  orgSettings: defineTable({
    businessName: v.string(),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zip: v.optional(v.string()),
      })
    ),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    publisherName: v.optional(v.string()),
    remitToName: v.optional(v.string()),
    remitToAddress: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zip: v.optional(v.string()),
      })
    ),
    showCreditCardSection: v.optional(v.boolean()),
    nsfFeeAmount: v.optional(v.number()),
    orgId: v.string(),
  }).index("by_orgId", ["orgId"]),

  dashboardStatsCache: defineTable({
    orgId: v.string(),
    calendarEditionId: v.id("calendarEditions"),
    year: v.number(),
    totalRevenue: v.number(),
    totalAmountPaid: v.number(),
    latePaymentsCount: v.number(),
    computedAt: v.number(),
  }).index("by_org_edition_year", ["orgId", "calendarEditionId", "year"]),

  // What happened the last time each advertiser was pushed to
  // ourcornercalendar.com. One row per contact, overwritten on each attempt --
  // this is a "did it get there" record, not a history.
  websiteSyncLog: defineTable({
    contactId: v.id("contacts"),
    ok: v.boolean(),
    detail: v.string(),
    websiteBusinessId: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_contactId", ["contactId"])
    .index("by_ok", ["ok"]),
});
