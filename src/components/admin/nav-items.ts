import {
  SquaresFour,
  Calendar,
  Users,
  Megaphone,
  ShoppingCart,
  Money,
  CreditCard,
  CalendarDots,
  BookOpen,
  MapPin,
  FileText,
  Tag,
  Ticket,
  VideoCamera,
  Palette,
  GearSix,
  CheckCircle,
  Printer,
  DownloadSimple,
  Storefront,
  Globe,
  UsersThree,
  ShieldCheck,
  type Icon,
} from "@phosphor-icons/react";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  color: string;
  /**
   * Extra words the jump box should match on. These are what someone actually
   * types when they do not know, or do not remember, what the page is called —
   * "ads" for Advertisements, "invoice" for Billing, "tags" for Categories.
   * Without them the search only finds a page if you already know its name,
   * which rather defeats the point.
   */
  keywords?: string[];
  /** Not shown in the sidebar, but reachable from the jump box. */
  searchOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: Icon;
  color: string;
  items: NavItem[];
}

export const DASHBOARD: NavItem = {
  label: "Dashboard",
  href: "/admin",
  icon: SquaresFour,
  color: "text-blue-500",
  keywords: ["home", "overview", "revenue", "summary"],
};

export const SETTINGS: NavItem = {
  label: "Settings",
  href: "/admin/settings",
  icon: GearSix,
  color: "text-gray-500",
  keywords: ["preferences", "options", "configuration"],
};

/**
 * The sidebar, grouped by the job being done rather than by which part of the
 * system a page belongs to.
 *
 * The previous arrangement was eight unrelated pages in a flat list, followed
 * by everything else hidden inside a collapsed group called "Community Site" —
 * a distinction that means something to whoever built it and nothing to the
 * person running a calendar business. Events and Categories lived in there,
 * which is why finding them meant opening a menu whose name does not contain
 * the word "events".
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "calendar",
    label: "The Calendar",
    icon: Calendar,
    color: "text-indigo-500",
    items: [
      {
        label: "Calendars",
        href: "/admin/calendars",
        icon: Calendar,
        color: "text-indigo-500",
        keywords: ["editions", "year", "issue"],
      },
      {
        label: "Events",
        href: "/admin/events",
        icon: CalendarDots,
        color: "text-pink-500",
        keywords: ["dates", "holidays", "schedule"],
      },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: Tag,
        color: "text-teal-500",
        keywords: ["tags", "labels", "groups", "csd", "school district"],
      },
      {
        label: "Export Events",
        href: "/admin/events/export",
        icon: DownloadSimple,
        color: "text-cyan-500",
        keywords: ["download", "csv", "spreadsheet", "backup"],
      },
      {
        label: "Print Inventory",
        href: "/admin/print",
        icon: Printer,
        color: "text-fuchsia-500",
        keywords: ["printing", "proof", "pdf", "press"],
      },
    ],
  },
  {
    id: "sales",
    label: "Ad Sales",
    icon: Storefront,
    color: "text-orange-500",
    items: [
      {
        label: "Advertisements",
        href: "/admin/advertisements",
        icon: Megaphone,
        color: "text-orange-500",
        keywords: ["ads", "adverts", "slots", "placements"],
      },
      {
        label: "Purchases",
        href: "/admin/purchases",
        icon: ShoppingCart,
        color: "text-emerald-500",
        keywords: ["orders", "sales", "sold", "bookings"],
      },
      {
        label: "Contacts",
        href: "/admin/contacts",
        icon: Users,
        color: "text-violet-500",
        keywords: ["advertisers", "customers", "clients", "businesses"],
      },
      {
        label: "Address Books",
        href: "/admin/address-books",
        icon: BookOpen,
        color: "text-amber-500",
        keywords: ["lists", "mailing", "groups"],
      },
    ],
  },
  {
    id: "money",
    label: "Money",
    icon: Money,
    color: "text-lime-600",
    items: [
      {
        label: "Billing",
        href: "/admin/billing",
        icon: CreditCard,
        color: "text-rose-500",
        keywords: ["invoices", "owed", "statements", "outstanding"],
      },
      {
        label: "Payments",
        href: "/admin/payments",
        icon: Money,
        color: "text-lime-500",
        keywords: ["paid", "received", "cash", "cheques", "late"],
      },
      {
        label: "This Month",
        href: "/admin/billing/this-month",
        icon: CreditCard,
        color: "text-rose-400",
        keywords: ["due", "monthly", "billing"],
        searchOnly: true,
      },
      {
        label: "Cash Flow",
        href: "/admin/billing/cash-flow",
        icon: Money,
        color: "text-lime-400",
        keywords: ["forecast", "projection", "billing"],
        searchOnly: true,
      },
    ],
  },
  {
    id: "website",
    label: "Website",
    icon: Globe,
    color: "text-sky-500",
    items: [
      {
        label: "Approvals",
        href: "/admin/approvals",
        icon: CheckCircle,
        color: "text-amber-500",
        keywords: ["pending", "review", "submitted", "queue"],
      },
      {
        label: "Blog",
        href: "/admin/blog",
        icon: FileText,
        color: "text-slate-500",
        keywords: ["posts", "articles", "news"],
      },
      {
        label: "Coupons",
        href: "/admin/coupons",
        icon: Ticket,
        color: "text-yellow-500",
        keywords: ["deals", "offers", "discounts", "savings"],
      },
      {
        label: "Videos",
        href: "/admin/videos",
        icon: VideoCamera,
        color: "text-red-500",
        keywords: ["clips", "youtube", "media"],
      },
      {
        label: "Communities",
        href: "/admin/communities",
        icon: MapPin,
        color: "text-green-500",
        keywords: ["towns", "cities", "areas", "places"],
      },
      {
        label: "Site Branding",
        href: "/admin/branding",
        icon: Palette,
        color: "text-purple-500",
        keywords: ["logo", "colours", "colors", "theme", "appearance"],
      },
    ],
  },
];

/**
 * Pages worth being able to jump to that do not earn a permanent row. A
 * sidebar long enough to contain everything is a sidebar nobody reads.
 */
const SEARCH_ONLY: NavItem[] = [
  {
    label: "Team",
    href: "/admin/settings/team",
    icon: UsersThree,
    color: "text-gray-500",
    keywords: ["staff", "users", "invite", "helpers", "people", "settings"],
    searchOnly: true,
  },
  {
    label: "Permissions",
    href: "/admin/settings/permissions",
    icon: ShieldCheck,
    color: "text-gray-500",
    keywords: ["access", "roles", "rights", "settings"],
    searchOnly: true,
  },
];

/** Every destination the jump box can reach, flattened once. */
export const ALL_DESTINATIONS: { item: NavItem; group: string }[] = [
  { item: DASHBOARD, group: "" },
  ...NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ item, group: g.label }))),
  { item: SETTINGS, group: "" },
  ...SEARCH_ONLY.map((item) => ({ item, group: "Settings" })),
];

/**
 * Which nav row should look active.
 *
 * Not a plain `startsWith`: "/admin/events/export" starts with
 * "/admin/events", so a naive check lights up two rows at once and neither is
 * obviously the right one. The longest matching href wins, so the export page
 * highlights Export Events and nothing else.
 */
export function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const { item } of ALL_DESTINATIONS) {
    const href = item.href;
    const matches =
      href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** Case-insensitive match on the page name, its group and its keywords. */
export function matchesQuery(entry: { item: NavItem; group: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    entry.item.label,
    entry.group,
    ...(entry.item.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
