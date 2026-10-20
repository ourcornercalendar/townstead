/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adPricing_mutations from "../adPricing/mutations.js";
import type * as adPricing_queries from "../adPricing/queries.js";
import type * as adSlots_queries from "../adSlots/queries.js";
import type * as addressBooks_mutations from "../addressBooks/mutations.js";
import type * as addressBooks_queries from "../addressBooks/queries.js";
import type * as advertisements_mutations from "../advertisements/mutations.js";
import type * as advertisements_queries from "../advertisements/queries.js";
import type * as approvals_queries from "../approvals/queries.js";
import type * as billing_helpers from "../billing/helpers.js";
import type * as billing_queries from "../billing/queries.js";
import type * as blog_mutations from "../blog/mutations.js";
import type * as blog_queries from "../blog/queries.js";
import type * as calendarEditions_mutations from "../calendarEditions/mutations.js";
import type * as calendarEditions_queries from "../calendarEditions/queries.js";
import type * as categories_mutations from "../categories/mutations.js";
import type * as categories_queries from "../categories/queries.js";
import type * as clientAssets_mutations from "../clientAssets/mutations.js";
import type * as clientAssets_queries from "../clientAssets/queries.js";
import type * as communities_mutations from "../communities/mutations.js";
import type * as communities_queries from "../communities/queries.js";
import type * as contacts_mutations from "../contacts/mutations.js";
import type * as contacts_queries from "../contacts/queries.js";
import type * as coupons_mutations from "../coupons/mutations.js";
import type * as coupons_queries from "../coupons/queries.js";
import type * as dashboard_mutations from "../dashboard/mutations.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as events_migration from "../events/migration.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_queries from "../events/queries.js";
import type * as files from "../files.js";
import type * as migration from "../migration.js";
import type * as migrations_migrateClientLinks from "../migrations/migrateClientLinks.js";
import type * as orgPermissions_mutations from "../orgPermissions/mutations.js";
import type * as orgPermissions_queries from "../orgPermissions/queries.js";
import type * as payments_mutations from "../payments/mutations.js";
import type * as payments_queries from "../payments/queries.js";
import type * as permissions from "../permissions.js";
import type * as portal_mutations from "../portal/mutations.js";
import type * as portal_queries from "../portal/queries.js";
import type * as portalInvites_mutations from "../portalInvites/mutations.js";
import type * as teamInvites_mutations from "../teamInvites/mutations.js";
import type * as teamInvites_queries from "../teamInvites/queries.js";
import type * as portalInvites_queries from "../portalInvites/queries.js";
import type * as public_mutations from "../public/mutations.js";
import type * as public_queries from "../public/queries.js";
import type * as purchases_mutations from "../purchases/mutations.js";
import type * as purchases_queries from "../purchases/queries.js";
import type * as scheduledPayments_mutations from "../scheduledPayments/mutations.js";
import type * as scheduledPayments_queries from "../scheduledPayments/queries.js";
import type * as seed from "../seed.js";
import type * as settings_mutations from "../settings/mutations.js";
import type * as settings_queries from "../settings/queries.js";
import type * as storage from "../storage.js";
import type * as tenantBranding_mutations from "../tenantBranding/mutations.js";
import type * as tenantBranding_queries from "../tenantBranding/queries.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as videos_mutations from "../videos/mutations.js";
import type * as videos_queries from "../videos/queries.js";
import type * as websiteSync_actions from "../websiteSync/actions.js";
import type * as websiteSync_auth from "../websiteSync/auth.js";
import type * as websiteSync_queries from "../websiteSync/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "adPricing/mutations": typeof adPricing_mutations;
  "adPricing/queries": typeof adPricing_queries;
  "adSlots/queries": typeof adSlots_queries;
  "addressBooks/mutations": typeof addressBooks_mutations;
  "addressBooks/queries": typeof addressBooks_queries;
  "advertisements/mutations": typeof advertisements_mutations;
  "advertisements/queries": typeof advertisements_queries;
  "approvals/queries": typeof approvals_queries;
  "billing/helpers": typeof billing_helpers;
  "billing/queries": typeof billing_queries;
  "blog/mutations": typeof blog_mutations;
  "blog/queries": typeof blog_queries;
  "calendarEditions/mutations": typeof calendarEditions_mutations;
  "calendarEditions/queries": typeof calendarEditions_queries;
  "categories/mutations": typeof categories_mutations;
  "categories/queries": typeof categories_queries;
  "clientAssets/mutations": typeof clientAssets_mutations;
  "clientAssets/queries": typeof clientAssets_queries;
  "communities/mutations": typeof communities_mutations;
  "communities/queries": typeof communities_queries;
  "contacts/mutations": typeof contacts_mutations;
  "contacts/queries": typeof contacts_queries;
  "coupons/mutations": typeof coupons_mutations;
  "coupons/queries": typeof coupons_queries;
  "dashboard/mutations": typeof dashboard_mutations;
  "dashboard/queries": typeof dashboard_queries;
  "events/migration": typeof events_migration;
  "events/mutations": typeof events_mutations;
  "events/queries": typeof events_queries;
  files: typeof files;
  migration: typeof migration;
  "migrations/migrateClientLinks": typeof migrations_migrateClientLinks;
  "orgPermissions/mutations": typeof orgPermissions_mutations;
  "orgPermissions/queries": typeof orgPermissions_queries;
  "payments/mutations": typeof payments_mutations;
  "payments/queries": typeof payments_queries;
  permissions: typeof permissions;
  "portal/mutations": typeof portal_mutations;
  "portal/queries": typeof portal_queries;
  "teamInvites/mutations": typeof teamInvites_mutations;
  "teamInvites/queries": typeof teamInvites_queries;
  "portalInvites/mutations": typeof portalInvites_mutations;
  "portalInvites/queries": typeof portalInvites_queries;
  "public/mutations": typeof public_mutations;
  "public/queries": typeof public_queries;
  "purchases/mutations": typeof purchases_mutations;
  "purchases/queries": typeof purchases_queries;
  "scheduledPayments/mutations": typeof scheduledPayments_mutations;
  "scheduledPayments/queries": typeof scheduledPayments_queries;
  seed: typeof seed;
  "settings/mutations": typeof settings_mutations;
  "settings/queries": typeof settings_queries;
  storage: typeof storage;
  "tenantBranding/mutations": typeof tenantBranding_mutations;
  "tenantBranding/queries": typeof tenantBranding_queries;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "videos/mutations": typeof videos_mutations;
  "videos/queries": typeof videos_queries;
  "websiteSync/actions": typeof websiteSync_actions;
  "websiteSync/auth": typeof websiteSync_auth;
  "websiteSync/queries": typeof websiteSync_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
