import { v } from "convex/values";

/**
 * Where a business's advertisement has got to.
 *
 * Joyce's artwork pipeline, in her words and her order: an ad is requested,
 * goes to Mark to be designed, goes to the client to look at, comes back with
 * changes or is approved, and finally gets placed in the calendar.
 *
 * This lives on the business rather than on a particular ad buy. That was a
 * deliberate choice of Joyce's when asked -- it is the answer to "where is
 * this business up to", which is the question she is actually asking when she
 * scans the list, and it stays true whether or not a purchase has been
 * recorded yet.
 *
 * The consequence to know about: there is one value per business, so when a
 * new calendar season starts the statuses carry over from last season and
 * want resetting. `adStatusUpdatedAt` is stored alongside so a stale one is
 * at least visible as stale rather than looking current.
 */

export const AD_STATUSES = [
  "requested",
  "sent_to_mark",
  "sent_to_client",
  "changes",
  "approved",
  "placed",
] as const;

export type AdStatus = (typeof AD_STATUSES)[number];

/** The validator for the schema and for any mutation taking one. */
export const adStatusValidator = v.union(
  v.literal("requested"),
  v.literal("sent_to_mark"),
  v.literal("sent_to_client"),
  v.literal("changes"),
  v.literal("approved"),
  v.literal("placed")
);

/**
 * Stored as a code rather than the label, so that renaming what Joyce sees --
 * "Sent to Mark" becomes "Sent to Design" the day Mark moves on -- is a change
 * to one line of text and not a migration of every business record.
 */
export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  requested: "Requested",
  sent_to_mark: "Sent to Mark",
  sent_to_client: "Sent to Client",
  changes: "Changes",
  approved: "Approved",
  placed: "Placed",
};
