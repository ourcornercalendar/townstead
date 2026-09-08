/**
 * Turning an ad-sales contact into a business profile on ourcornercalendar.com.
 *
 * Joyce keeps one customer list, here, and the website shows it. When she adds
 * an advertiser on this site a business profile appears there ready for her to
 * publish; when she corrects a phone number here, the website's copy changes
 * too.
 *
 * The mapping is kept pure and in its own file so it can be tested without a
 * Convex deployment or a Supabase project, and so the exact shape written to
 * the website is readable in one place rather than buried in an HTTP call.
 */

export interface SyncAddress {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface SyncContact {
  _id: string;
  company: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  cellPhone?: string;
  website?: string;
  address?: SyncAddress;
  description?: string;
  notes?: string;
  isDeleted?: boolean;
  showOnWebsite?: boolean;
}

export interface ProfilePhoto {
  url: string;
  caption: string;
}

export interface ProfilePayload {
  townstead_contact_id: string;
  name: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  zip: string;
  category: string;
  description: string;
  hidden: boolean;
  photos?: ProfilePhoto[];
  updated_at: string;
}

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** "123 Main St, Suite 2" — street lines only; city and zip have their own columns. */
export function formatStreet(address?: SyncAddress): string {
  return [clean(address?.street), clean(address?.street2)]
    .filter(Boolean)
    .join(", ");
}

/** "Jane Smith", or "" when neither name is filled in. */
export function formatPerson(contact: SyncContact): string {
  return [clean(contact.firstName), clean(contact.lastName)]
    .filter(Boolean)
    .join(" ");
}

/**
 * A website address the browser will actually follow.
 *
 * Joyce types "example.com" as often as she types the full thing, and a link
 * saved without a scheme resolves against ourcornercalendar.com and 404s. This
 * is the sort of small correction that is invisible until a customer complains
 * their link is broken.
 */
export function normaliseWebsite(raw?: string): string {
  const value = clean(raw);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";   // mailto:, javascript:, …
  return `https://${value}`;
}

/**
 * The row to write to business_profiles.
 *
 * A new business arrives **hidden**, and Joyce shows it from her admin when it
 * is ready to be seen. That is not caution for its own sake: 815 imported
 * advertisers once appeared in the public directory at once, and a directory
 * entry carrying a name and a phone number and nothing else is not something
 * she would have written. One click to publish is a smaller cost than the
 * afternoon that cleanup took.
 *
 * A logo comes across as the first photo, so a published business does not
 * look empty. Only on the way in -- see updatePayload, which never sends
 * photos, because after that they are the website's.
 */
export function contactToProfile(
  contact: SyncContact,
  options: { categoryName?: string; logoUrl?: string; now?: () => Date } = {}
): ProfilePayload {
  const now = options.now ? options.now() : new Date();
  const logo = clean(options.logoUrl);
  return {
    townstead_contact_id: contact._id,
    name: clean(contact.company),
    contact_name: formatPerson(contact),
    contact_email: clean(contact.email),
    phone: clean(contact.phone) || clean(contact.cellPhone),
    website: normaliseWebsite(contact.website),
    address: formatStreet(contact.address),
    city: clean(contact.address?.city),
    zip: clean(contact.address?.zip),
    category: clean(options.categoryName),
    description: clean(contact.description),
    hidden: true,
    ...(logo ? { photos: [{ url: logo, caption: "" }] } : {}),
    updated_at: now.toISOString(),
  };
}

/**
 * Fields the website owns once a profile exists.
 *
 * The first sync of a contact fills a profile in. After that Joyce may write a
 * description on the website, pick a category from the website's own list, or
 * upload photos — and the ad sales site knows nothing about any of that. The
 * two sites also keep different category lists, so pushing one into the other
 * on every save would fight her. An update sends only the fields the ad sales
 * site is genuinely the source of truth for.
 */
export const WEBSITE_OWNED_AFTER_CREATE = [
  "category",
  "description",
  // Photos are the website's once the business has any. updatePayload adds the
  // logo back only when the gallery is empty -- re-sending it every save would
  // push it in front of a storefront picture somebody chose.
  "photos",
  // Whether a business shows in the public directory is the website's decision,
  // never a side effect of correcting a phone number here. A business Joyce has
  // published stays published, and one she has hidden stays hidden, however
  // often it is edited on this side. Only a delete sets it, via hidePayload.
  "hidden",
] as const;

/**
 * What to send when the profile already exists.
 *
 * Blank fields are dropped rather than sent. A contact with no phone number in
 * the ad sales system does not mean "the website's phone number is wrong" — it
 * means Joyce never typed one here, and sending "" would erase a number
 * somebody entered on the website. Emptying a field on the website is
 * therefore done on the website, which is where it is visible.
 */
export function updatePayload(
  payload: ProfilePayload,
  existing: { photos?: { url?: string }[] | null } = {}
): Partial<ProfilePayload> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if ((WEBSITE_OWNED_AFTER_CREATE as readonly string[]).includes(key)) continue;
    if (value === "") continue;
    out[key] = value;
  }

  // The logo may still be wanted even though this business already exists --
  // the businesses carried over from the old system were all created before
  // logos were being sent, and most advertisers reach the website by being
  // matched rather than created. So it goes in, but only into an empty
  // gallery: a business with a photo on it has one somebody chose.
  const gallery = (existing.photos || []).filter((p) => p && p.url);
  if (payload.photos?.length && gallery.length === 0) {
    out.photos = payload.photos;
  }

  return out as Partial<ProfilePayload>;
}

/**
 * What to send when Joyce has deleted the advertiser here.
 *
 * Only the one field. A deleted contact has had its email cleared by the
 * delete itself, and sending that emptiness onward would unlink the business
 * from its owner's login on the website — a customer locked out of their own
 * portal because a sales record was tidied up.
 */
export function hidePayload(payload: ProfilePayload): Partial<ProfilePayload> {
  return { hidden: true, updated_at: payload.updated_at };
}
