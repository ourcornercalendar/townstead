export const PERMISSIONS = {
  // Events — tiered actions
  EVENTS_SUBMIT: "events:submit",
  EVENTS_CREATE: "events:create",
  EVENTS_UPDATE_OWN: "events:update_own",
  EVENTS_DELETE_OWN: "events:delete_own",
  // Edit or delete any event in the organisation, not only one's own. For a
  // colleague genuinely sharing the calendar work rather than contributing to
  // it. Deliberately does not include approving other people's submissions.
  EVENTS_MANAGE_ALL: "events:manage_all",
  // Edit or delete ANY event, separately. `manage_all` above is the older
  // all-or-nothing version of the same idea and still means both, so nobody
  // granted it before loses anything; these two exist because the owner
  // wanted "edit" and "delete" to be switches she can throw independently.
  EVENTS_UPDATE_ANY: "events:update_any",
  EVENTS_DELETE_ANY: "events:delete_any",
  EVENTS_APPROVE: "events:approve",

  // Categories — the owner's own filing scheme (CSD, School District, …).
  // There were no permissions for these at all: category editing was
  // org-members-only, so a helper could not be given it however much the
  // owner wanted to.
  CATEGORIES_CREATE: "categories:create",
  CATEGORIES_UPDATE: "categories:update",
  CATEGORIES_DELETE: "categories:delete",

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
  PERMISSIONS.EVENTS_MANAGE_ALL,
  PERMISSIONS.EVENTS_UPDATE_ANY,
  PERMISSIONS.EVENTS_DELETE_ANY,
  // Approving was deliberately withheld until now: it is the one permission
  // that takes the owner out of the loop entirely, so whatever a helper
  // publishes goes to print without her seeing it. It is assignable at her
  // explicit request, and the Team screen keeps it apart from the rest and
  // off by default.
  PERMISSIONS.EVENTS_APPROVE,
  PERMISSIONS.CATEGORIES_CREATE,
  PERMISSIONS.CATEGORIES_UPDATE,
  PERMISSIONS.CATEGORIES_DELETE,
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


/**
 * Can this set of permissions change an event somebody else entered?
 *
 * `manage_all` is the original single permission meaning both; the two
 * specific ones came later. Anything asking "may they touch other people's
 * events" has to accept either, or a grant made before the split stops
 * working.
 */
export function canEditAnyEvent(permissions: readonly string[]): boolean {
  return (
    permissions.includes(PERMISSIONS.EVENTS_UPDATE_ANY) ||
    permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL)
  );
}

export function canDeleteAnyEvent(permissions: readonly string[]): boolean {
  return (
    permissions.includes(PERMISSIONS.EVENTS_DELETE_ANY) ||
    permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL)
  );
}

/**
 * Whether the events list should show the whole calendar rather than only
 * what this person entered. Anyone who can edit, delete or approve other
 * people's events has to be able to see them first — a permission to change
 * something invisible is no permission at all.
 */
export function canSeeAllEvents(permissions: readonly string[]): boolean {
  return (
    canEditAnyEvent(permissions) ||
    canDeleteAnyEvent(permissions) ||
    permissions.includes(PERMISSIONS.EVENTS_APPROVE)
  );
}
