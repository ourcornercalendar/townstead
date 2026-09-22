export const PERMISSIONS = {
  // Events — tiered actions
  EVENTS_SUBMIT: "events:submit",
  EVENTS_CREATE: "events:create",
  EVENTS_UPDATE_OWN: "events:update_own",
  EVENTS_DELETE_OWN: "events:delete_own",
  EVENTS_APPROVE: "events:approve",

  // Blog — tiered actions
  BLOG_SUBMIT: "blog:submit",
  BLOG_CREATE: "blog:create",
  BLOG_UPDATE_OWN: "blog:update_own",
  BLOG_DELETE_OWN: "blog:delete_own",
  BLOG_APPROVE: "blog:approve",

  // Videos — tiered actions
  VIDEOS_SUBMIT: "videos:submit",
  VIDEOS_CREATE: "videos:create",
  VIDEOS_UPDATE_OWN: "videos:update_own",
  VIDEOS_DELETE_OWN: "videos:delete_own",
  VIDEOS_APPROVE: "videos:approve",

  // Coupons — binary
  COUPONS_CLAIM: "coupons:claim",

  // Portal — feature flags
  PORTAL_VIEW: "portal:view",
  PORTAL_ASSETS: "portal:assets",
  PORTAL_MESSAGES: "portal:messages",
  PORTAL_PAYMENTS: "portal:payments",
  PORTAL_INVOICES: "portal:invoices",
  PORTAL_PLACEMENTS: "portal:placements",

  // Directory — binary
  DIRECTORY_CLAIM: "directory:claim",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Permission domains that support tiered CRUD actions.
 * `submit` = create with approval required.
 * `create` = create with auto-approval (supersedes submit).
 */
export const TIERED_DOMAINS = {
  events: {
    submit: PERMISSIONS.EVENTS_SUBMIT,
    create: PERMISSIONS.EVENTS_CREATE,
    updateOwn: PERMISSIONS.EVENTS_UPDATE_OWN,
    deleteOwn: PERMISSIONS.EVENTS_DELETE_OWN,
    approve: PERMISSIONS.EVENTS_APPROVE,
  },
  blog: {
    submit: PERMISSIONS.BLOG_SUBMIT,
    create: PERMISSIONS.BLOG_CREATE,
    updateOwn: PERMISSIONS.BLOG_UPDATE_OWN,
    deleteOwn: PERMISSIONS.BLOG_DELETE_OWN,
    approve: PERMISSIONS.BLOG_APPROVE,
  },
  videos: {
    submit: PERMISSIONS.VIDEOS_SUBMIT,
    create: PERMISSIONS.VIDEOS_CREATE,
    updateOwn: PERMISSIONS.VIDEOS_UPDATE_OWN,
    deleteOwn: PERMISSIONS.VIDEOS_DELETE_OWN,
    approve: PERMISSIONS.VIDEOS_APPROVE,
  },
} as const;

export type TieredDomain = keyof typeof TIERED_DOMAINS;

export const DEFAULT_CONTACT_PERMISSIONS: Permission[] = [
  PERMISSIONS.PORTAL_VIEW,
  PERMISSIONS.PORTAL_ASSETS,
  PERMISSIONS.PORTAL_MESSAGES,
  PERMISSIONS.PORTAL_PAYMENTS,
  PERMISSIONS.PORTAL_INVOICES,
  PERMISSIONS.EVENTS_SUBMIT,
  PERMISSIONS.EVENTS_UPDATE_OWN,
  PERMISSIONS.BLOG_SUBMIT,
  PERMISSIONS.BLOG_UPDATE_OWN,
  PERMISSIONS.VIDEOS_SUBMIT,
  PERMISSIONS.VIDEOS_UPDATE_OWN,
];

export const DEFAULT_USER_PERMISSIONS: Permission[] = [
  PERMISSIONS.EVENTS_SUBMIT,
  PERMISSIONS.VIDEOS_SUBMIT,
  PERMISSIONS.COUPONS_CLAIM,
];

/**
 * What an admin is allowed to hand to a staff member from the Team screen.
 *
 * Deliberately excludes every `portal:*` permission. Those open the advertiser
 * billing portal -- invoices, payments, statements -- which has nothing to do
 * with helping run the calendar, and is exactly the sort of thing that should
 * not be reachable by ticking a box on a page about adding a helper.
 */
export const TEAM_ASSIGNABLE_PERMISSIONS: Permission[] = [
  PERMISSIONS.EVENTS_SUBMIT,
  PERMISSIONS.EVENTS_CREATE,
  PERMISSIONS.EVENTS_UPDATE_OWN,
  PERMISSIONS.EVENTS_DELETE_OWN,
  PERMISSIONS.BLOG_SUBMIT,
  PERMISSIONS.BLOG_CREATE,
  PERMISSIONS.BLOG_UPDATE_OWN,
  PERMISSIONS.BLOG_DELETE_OWN,
  PERMISSIONS.VIDEOS_SUBMIT,
  PERMISSIONS.VIDEOS_CREATE,
  PERMISSIONS.VIDEOS_UPDATE_OWN,
  PERMISSIONS.VIDEOS_DELETE_OWN,
];

export const ROLE_VALUES = ["admin", "contact", "user"] as const;
export type Role = (typeof ROLE_VALUES)[number];
