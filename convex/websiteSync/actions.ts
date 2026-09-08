import { internalAction, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { contactToProfile, updatePayload, hidePayload } from "./map";
import { chooseProfile } from "./match";
import { readConfig, findProfiles, insertProfile, updateProfile } from "./website";

/**
 * Push one advertiser to ourcornercalendar.com.
 *
 * Scheduled from the contact mutations rather than called inside them, for two
 * reasons: a Convex mutation cannot make a network request at all, and if it
 * could, the website being slow or down would make Joyce's save fail. She
 * should be able to add a customer whether or not the website is reachable;
 * the sync catches up, and anything that did not make it is recorded.
 */
export const pushContact = internalAction({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args): Promise<{ ok: boolean; detail: string }> => {
    const record = async (ok: boolean, detail: string, websiteBusinessId?: string) => {
      await ctx.runMutation(internal.websiteSync.queries.recordResult, {
        contactId: args.contactId,
        ok,
        detail,
        websiteBusinessId,
      });
      return { ok, detail };
    };

    const config = readConfig();
    if (!config) {
      // Deliberately recorded as a failure. A deployment with no website
      // configured is not syncing, and saying nothing would let that look like
      // success for as long as nobody checked the website.
      return await record(false, "This deployment has no website configured, so nothing was sent.");
    }

    const gathered = await ctx.runQuery(internal.websiteSync.queries.gatherContact, {
      contactId: args.contactId,
    });
    if (!gathered) return await record(false, "That contact no longer exists.");

    const { contact, categoryName, logoUrl } = gathered;
    const payload = contactToProfile(contact, { categoryName, logoUrl });

    if (!payload.name) {
      return await record(false, "A business needs a company name before it can appear on the website.");
    }

    try {
      const [byContactId, byEmail, byName] = await Promise.all([
        findProfiles(config, "townstead_contact_id", contact._id),
        payload.contact_email
          ? findProfiles(config, "contact_email", payload.contact_email)
          : Promise.resolve([]),
        findProfiles(config, "name", payload.name),
      ]);

      const decision = chooseProfile(contact._id, { byContactId, byEmail, byName });

      // Two different reasons a business should not be on show, treated the
      // same way. Deletion is the contact's own state rather than the
      // payload's -- every new profile is written hidden now, so
      // `payload.hidden` no longer distinguishes "Joyce deleted this" from
      // "this is new".
      //
      // The second reason is the one that keeps the directory honest: the
      // contact list is a sales list, and an advertiser appears on the website
      // only because Joyce said so. Enforcing that here rather than only at
      // the point of saving means a backfill cannot push the whole list across
      // either.
      const wasDeleted = contact.isDeleted === true;
      const notChosen = contact.showOnWebsite !== true;
      const takeItDown = wasDeleted || notChosen;

      if (decision.action === "update") {
        const existing =
          [...byContactId, ...byEmail, ...byName].find((r) => r.id === decision.id) ?? {};
        const body = takeItDown ? hidePayload(payload) : updatePayload(payload, existing);
        const row = await updateProfile(config, decision.id, body);
        const how =
          wasDeleted ? "Hidden on the website, because it was deleted here"
          : notChosen ? "Hidden on the website, because it is no longer set to show there"
          :
          decision.how === "link" ? "Updated the business it is linked to"
          : decision.how === "email" ? "Matched an existing business by email and linked it"
          : "Matched an existing business by name and linked it";
        return await record(true, `${how}.`, row.id);
      }

      if (wasDeleted) {
        // Deleted here and never on the website: there is nothing to hide, and
        // creating a hidden business would be adding a row so it can be
        // ignored.
        return await record(true, "Deleted here, and it was never on the website.");
      }

      if (notChosen) {
        // The ordinary case for most of the list. Nothing is created, because
        // a hidden row nobody asked for is still a row Joyce has to read past
        // to find the ones that matter.
        return await record(
          true,
          "Not set to show on the website, so nothing was sent."
        );
      }

      const row = await insertProfile(config, payload);
      return await record(
        true,
        "Added to the website, hidden until you publish it.",
        row.id
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return await record(false, detail);
    }
  },
});

/**
 * Send every advertiser to the website.
 *
 * For the first run, and for catching up after the website has been
 * unreachable. Safe to run more than once: a contact already linked to a
 * business updates it rather than making a second one.
 */
export const syncAll = action({
  args: { orgId: v.string() },
  handler: async (ctx, args): Promise<{ attempted: number }> => {
    await ctx.runQuery(internal.websiteSync.auth.assertOwner, { orgId: args.orgId });

    let cursor: string | null = null;
    let attempted = 0;

    for (;;) {
      const page: { ids: Id<"contacts">[]; cursor: string; isDone: boolean } =
        await ctx.runQuery(internal.websiteSync.queries.listContactsPage, {
          orgId: args.orgId,
          cursor,
          pageSize: 50,
        });

      for (const id of page.ids) {
        // One at a time on purpose. Eight hundred simultaneous writes to the
        // website would be a self-inflicted denial of service on Joyce's own
        // site, and the backfill is a thing you run once.
        await ctx.runAction(internal.websiteSync.actions.pushContact, { contactId: id });
        attempted += 1;
      }

      if (page.isDone) break;
      cursor = page.cursor;
    }

    return { attempted };
  },
});
