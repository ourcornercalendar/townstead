import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS } from "../permissions";

describe("public", () => {
  it("getHomepageData returns null for unknown orgSlug", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const result = await asOrg.query(api.public.queries.getHomepageData, {
      orgSlug: "nonexistent",
      now: 1710000000000,
    });
    expect(result).toBeNull();
  });

  it("getHomepageData returns branding and content for valid slug", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "test-community",
        siteName: "Test Community",
      });
    });

    const result = await asOrg.query(api.public.queries.getHomepageData, {
      orgSlug: "test-community",
      now: 1710000000000,
    });
    expect(result).not.toBeNull();
    expect(result!.branding.siteName).toBe("Test Community");
    expect(result!.featuredEvents).toHaveLength(0);
    expect(result!.featuredBusinesses).toHaveLength(0);
  });

  it("tenant isolation — listEvents returns empty for unknown slug", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const result = await asOrg.query(api.public.queries.listEvents, {
      orgSlug: "no-such-org",
    });
    expect(result).toHaveLength(0);
  });

  it("listEvents returns approved, non-deleted events for a valid slug", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "events-org",
        siteName: "Events Org",
      });
      await ctx.db.insert("events", {
        name: "Active Event",
        date: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: true,
      });
      await ctx.db.insert("events", {
        name: "Deleted Event",
        date: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: true,
        isApproved: true,
      });
      await ctx.db.insert("events", {
        name: "Rejected Event",
        date: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
    });

    const events = await asOrg.query(api.public.queries.listEvents, {
      orgSlug: "events-org",
    });
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("Active Event");
  });

  it("getEvent returns null for unapproved events", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Unapproved",
        date: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: false,
      });
    });

    const result = await asOrg.query(api.public.queries.getEvent, { id: eventId });
    expect(result).toBeNull();
  });

  it("getEvent returns approved events", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "Approved Event",
        date: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: true,
      });
    });

    const result = await asOrg.query(api.public.queries.getEvent, { id: eventId });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Approved Event");
  });

  it("getEvent returns imageUrl as null when no image is set", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        name: "No Image Event",
        date: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
        isApproved: true,
      });
    });

    const result = await asOrg.query(api.public.queries.getEvent, { id: eventId });
    expect(result).not.toBeNull();
    expect(result!.imageUrl).toBeNull();
  });

  it("listEvents returns imageUrl as null when no image is set", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_img",
        orgSlug: "img-org",
        siteName: "Image Org",
      });
      await ctx.db.insert("events", {
        name: "Event Without Image",
        date: Date.now() + 100000000,
        orgId: "org_img",
        isDeleted: false,
        isApproved: true,
      });
    });

    const events = await asOrg.query(api.public.queries.listEvents, {
      orgSlug: "img-org",
    });
    expect(events).toHaveLength(1);
    expect(events[0].imageUrl).toBeNull();
  });

  it("getHomepageData includes imageUrl on featured events", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_hp",
        orgSlug: "hp-org",
        siteName: "HP Org",
      });
      await ctx.db.insert("events", {
        name: "HP Event",
        date: Date.now() + 100000000,
        orgId: "org_hp",
        isDeleted: false,
        isApproved: true,
      });
    });

    const result = await asOrg.query(api.public.queries.getHomepageData, {
      orgSlug: "hp-org",
      now: Date.now(),
    });
    expect(result).not.toBeNull();
    expect(result!.featuredEvents).toHaveLength(1);
    expect(result!.featuredEvents[0]).toHaveProperty("imageUrl");
    expect(result!.featuredEvents[0].imageUrl).toBeNull();
  });

  it("submitEvent requires authentication", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "submit-org",
        siteName: "Submit Org",
      });
    });

    await expect(
      t.mutation(api.public.mutations.submitEvent, {
        orgSlug: "submit-org",
        name: "Anon Event",
        date: 1800000000000,
      })
    ).rejects.toThrowError("Not authenticated");
  });

  it("submitEvent creates a pending event with permission", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "submit-org",
        siteName: "Submit Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.EVENTS_SUBMIT, PERMISSIONS.COUPONS_CLAIM],
      });
    });

    const authed = t.withIdentity({ subject: "user_abc" });
    const eventId = await authed.mutation(api.public.mutations.submitEvent, {
      orgSlug: "submit-org",
      name: "Community Meetup",
      date: 1800000000000,
    });
    expect(eventId).toBeTruthy();

    const doc = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(doc!.name).toBe("Community Meetup");
    expect(doc!.isApproved).toBe(false);
    expect(doc!.orgId).toBe("org_1");
    expect(doc!.submittedBy).toBe("user_abc");
  });

  it("submitEvent denied without permission", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "locked-org",
        siteName: "Locked Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_no_perms" });
    await expect(
      authed.mutation(api.public.mutations.submitEvent, {
        orgSlug: "locked-org",
        name: "Blocked Event",
        date: 1800000000000,
      })
    ).rejects.toThrowError("Permission denied");
  });

  it("submitEvent auto-approves when user has events:create", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "auto-org",
        siteName: "Auto Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.EVENTS_CREATE],
      });
    });

    const authed = t.withIdentity({ subject: "trusted_user" });
    const eventId = await authed.mutation(api.public.mutations.submitEvent, {
      orgSlug: "auto-org",
      name: "Auto-Approved Event",
      date: 1800000000000,
    });
    expect(eventId).toBeTruthy();

    const doc = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(doc!.isApproved).toBe(true);
  });

  it("submitEvent with explicit events:create grant auto-approves over submit defaults", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "mixed-org",
        siteName: "Mixed Org",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.EVENTS_SUBMIT],
      });
      await ctx.db.insert("orgPermissions", {
        userId: "promoted_user",
        orgId: "org_1",
        role: "user",
        permissions: [PERMISSIONS.EVENTS_CREATE],
        isActive: true,
      });
    });

    const authed = t.withIdentity({ subject: "promoted_user" });
    const eventId = await authed.mutation(api.public.mutations.submitEvent, {
      orgSlug: "mixed-org",
      name: "Promoted Event",
      date: 1800000000000,
    });

    const doc = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(doc!.isApproved).toBe(true);
  });

  it("claimCoupon requires authentication", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "20% Off",
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    await expect(
      t.mutation(api.public.mutations.claimCoupon, { couponId })
    ).rejects.toThrowError("Not authenticated");
  });

  it("claimCoupon creates a claim and rejects at perUserLimit=1", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "20% Off",
        perUserLimit: 1,
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const authed = t.withIdentity({ subject: "user_claimer" });
    const claimId = await authed.mutation(api.public.mutations.claimCoupon, {
      couponId,
    });
    expect(claimId).toBeTruthy();

    await expect(
      authed.mutation(api.public.mutations.claimCoupon, { couponId })
    ).rejects.toThrowError("Per-user claim limit reached");
  });

  it("claimCoupon allows multiple claims when perUserLimit > 1", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Multi Claim",
        perUserLimit: 3,
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const authed = t.withIdentity({ subject: "user_multi" });
    await authed.mutation(api.public.mutations.claimCoupon, { couponId });
    await authed.mutation(api.public.mutations.claimCoupon, { couponId });
    await authed.mutation(api.public.mutations.claimCoupon, { couponId });

    await expect(
      authed.mutation(api.public.mutations.claimCoupon, { couponId })
    ).rejects.toThrowError("Per-user claim limit reached");
  });

  it("claimCoupon allows unlimited claims when perUserLimit is not set", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Unlimited Per User",
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const authed = t.withIdentity({ subject: "user_unlimited" });
    await authed.mutation(api.public.mutations.claimCoupon, { couponId });
    await authed.mutation(api.public.mutations.claimCoupon, { couponId });
    await authed.mutation(api.public.mutations.claimCoupon, { couponId });

    const claims = await t.run(async (ctx) => {
      return await ctx.db
        .query("couponClaims")
        .withIndex("by_couponId_and_userId", (q) =>
          q.eq("couponId", couponId).eq("userId", "user_unlimited")
        )
        .collect();
    });
    expect(claims).toHaveLength(3);
  });

  it("claimCoupon respects quantityLimit total cap", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Limited Supply",
        quantityLimit: 2,
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const user1 = t.withIdentity({ subject: "user_a" });
    const user2 = t.withIdentity({ subject: "user_b" });
    const user3 = t.withIdentity({ subject: "user_c" });

    await user1.mutation(api.public.mutations.claimCoupon, { couponId });
    await user2.mutation(api.public.mutations.claimCoupon, { couponId });

    await expect(
      user3.mutation(api.public.mutations.claimCoupon, { couponId })
    ).rejects.toThrowError("Coupon claim limit reached");
  });

  it("claimCoupon rejects expired coupon", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Old Deal",
        startDate: 1000000000000,
        endDate: 1000000001000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const authed = t.withIdentity({ subject: "user_late" });
    await expect(
      authed.mutation(api.public.mutations.claimCoupon, { couponId })
    ).rejects.toThrowError("expired");
  });

  it("getCouponClaimInfo returns totalClaims and userClaims for authenticated user", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      return await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Info Test",
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
    });

    const user1 = t.withIdentity({ subject: "user_info_1" });
    const user2 = t.withIdentity({ subject: "user_info_2" });

    await user1.mutation(api.public.mutations.claimCoupon, { couponId });
    await user1.mutation(api.public.mutations.claimCoupon, { couponId });
    await user2.mutation(api.public.mutations.claimCoupon, { couponId });

    const info1 = await user1.query(api.public.queries.getCouponClaimInfo, { couponId });
    expect(info1.totalClaims).toBe(3);
    expect(info1.userClaims).toBe(2);

    const info2 = await user2.query(api.public.queries.getCouponClaimInfo, { couponId });
    expect(info2.totalClaims).toBe(3);
    expect(info2.userClaims).toBe(1);
  });

  it("getCouponClaimInfo returns 0 userClaims for unauthenticated user", async () => {
    const t = convexTest(schema, modules);

    const couponId = await t.run(async (ctx) => {
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_1",
      });
      await ctx.db.insert("orgPermissionDefaults", {
        orgId: "org_1",
        contactDefaults: [],
        userDefaults: [PERMISSIONS.COUPONS_CLAIM],
      });
      const cId = await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Unauthed Test",
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("couponClaims", {
        couponId: cId,
        userId: "someone",
        claimedAt: Date.now(),
      });
      return cId;
    });

    const info = await t.query(api.public.queries.getCouponClaimInfo, { couponId });
    expect(info.totalClaims).toBe(1);
    expect(info.userClaims).toBe(0);
  });

  it("listCoupons returns isSoldOut=true when quantityLimit is reached", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_soldout",
        orgSlug: "soldout-org",
      });
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_soldout",
      });
      const couponId = await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Sold Out Deal",
        quantityLimit: 1,
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_soldout",
        isDeleted: false,
      });
      await ctx.db.insert("couponClaims", {
        couponId,
        userId: "claimer",
        claimedAt: Date.now(),
      });
    });

    const results = await asOrg.query(api.public.queries.listCoupons, {
      orgSlug: "soldout-org",
      now: Date.now(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].isSoldOut).toBe(true);
    expect(results[0].claimCount).toBe(1);
  });

  it("listCoupons returns isSoldOut=false when quantityLimit is not reached", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_avail",
        orgSlug: "avail-org",
      });
      const contactId = await ctx.db.insert("contacts", {
        company: "Biz",
        firstName: "A",
        lastName: "B",
        orgId: "org_avail",
      });
      await ctx.db.insert("coupons", {
        businessContactId: contactId,
        title: "Still Available",
        quantityLimit: 10,
        startDate: Date.now() - 100000000,
        endDate: Date.now() + 100000000,
        orgId: "org_avail",
        isDeleted: false,
      });
    });

    const results = await asOrg.query(api.public.queries.listCoupons, {
      orgSlug: "avail-org",
      now: Date.now(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].isSoldOut).toBe(false);
    expect(results[0].claimCount).toBe(0);
  });

  it("getHomepageData returns logoUrl and heroImageUrl on branding", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_brand",
        orgSlug: "brand-org",
        siteName: "Brand Org",
      });
    });

    const result = await asOrg.query(api.public.queries.getHomepageData, {
      orgSlug: "brand-org",
      now: Date.now(),
    });
    expect(result).not.toBeNull();
    expect(result!.branding).toHaveProperty("logoUrl");
    expect(result!.branding).toHaveProperty("heroImageUrl");
    expect(result!.branding.logoUrl).toBeNull();
    expect(result!.branding.heroImageUrl).toBeNull();
  });

  it("listCommunities returns imageUrl for each community", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_com",
        orgSlug: "com-org",
        siteName: "Com Org",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Edition 1",
        code: "E1",
        orgId: "org_com",
        isDeleted: false,
      });
      await ctx.db.insert("communities", {
        name: "Test Community",
        slug: "test-community",
        calendarEditionIds: [editionId],
        orgId: "org_com",
      });
    });

    const communities = await asOrg.query(api.public.queries.listCommunities, {
      orgSlug: "com-org",
    });
    expect(communities).toHaveLength(1);
    expect(communities[0]).toHaveProperty("imageUrl");
    expect(communities[0].imageUrl).toBeNull();
  });

  it("listCommunities excludes soft-deleted communities", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_del",
        orgSlug: "del-org",
        siteName: "Del Org",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Edition",
        code: "ED",
        orgId: "org_del",
        isDeleted: false,
      });
      await ctx.db.insert("communities", {
        name: "Active Community",
        slug: "active",
        calendarEditionIds: [editionId],
        orgId: "org_del",
      });
      await ctx.db.insert("communities", {
        name: "Deleted Community",
        slug: "deleted",
        calendarEditionIds: [editionId],
        orgId: "org_del",
        isDeleted: true,
      });
    });

    const communities = await asOrg.query(api.public.queries.listCommunities, {
      orgSlug: "del-org",
    });
    expect(communities).toHaveLength(1);
    expect(communities[0].name).toBe("Active Community");
  });

  it("getCommunityBySlug returns imageUrl", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_cs",
        orgSlug: "cs-org",
        siteName: "CS Org",
      });
      const editionId = await ctx.db.insert("calendarEditions", {
        name: "Edition",
        code: "E",
        orgId: "org_cs",
        isDeleted: false,
      });
      await ctx.db.insert("communities", {
        name: "Slug Community",
        slug: "slug-community",
        calendarEditionIds: [editionId],
        orgId: "org_cs",
      });
    });

    const result = await asOrg.query(api.public.queries.getCommunityBySlug, {
      orgSlug: "cs-org",
      communitySlug: "slug-community",
    });
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("imageUrl");
    expect(result!.imageUrl).toBeNull();
  });

  it("getCommunityBySlug returns null for unknown slug", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_nf",
        orgSlug: "nf-org",
        siteName: "NF Org",
      });
    });

    const result = await asOrg.query(api.public.queries.getCommunityBySlug, {
      orgSlug: "nf-org",
      communitySlug: "nonexistent",
    });
    expect(result).toBeNull();
  });

  it("listPublicSites returns all tenants with public-safe fields", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_a",
        orgSlug: "alpha",
        siteName: "Alpha Community",
        tagline: "First org",
      });
      await ctx.db.insert("tenantBranding", {
        orgId: "org_b",
        orgSlug: "beta",
        siteName: "Beta Community",
      });
    });

    const sites = await asOrg.query(api.public.queries.listPublicSites, {});
    expect(sites).toHaveLength(2);
    expect(sites[0]).toMatchObject({
      orgSlug: "alpha",
      siteName: "Alpha Community",
      tagline: "First org",
      logo: null,
    });
    expect(sites[1]).toMatchObject({
      orgSlug: "beta",
      siteName: "Beta Community",
      tagline: null,
      logo: null,
    });
  });

  it("listPublicSites returns empty array when no tenants exist", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });
    const sites = await asOrg.query(api.public.queries.listPublicSites, {});
    expect(sites).toHaveLength(0);
  });

  it("listPublicSites omits internal fields like orgId", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_secret",
        orgSlug: "public-slug",
        siteName: "Public Site",
      });
    });

    const sites = await asOrg.query(api.public.queries.listPublicSites, {});
    expect(sites).toHaveLength(1);
    const keys = Object.keys(sites[0]);
    expect(keys).not.toContain("orgId");
    expect(keys).not.toContain("_id");
    expect(keys).not.toContain("_creationTime");
  });

  it("listBlogPosts returns published non-deleted posts", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_1",
        orgSlug: "blog-org",
        siteName: "Blog Org",
      });
      await ctx.db.insert("blogPosts", {
        title: "Published Post",
        slug: "published",
        content: "Content here",
        status: "published",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Draft Post",
        slug: "draft",
        content: "Not ready",
        status: "draft",
        orgId: "org_1",
        isDeleted: false,
      });
      await ctx.db.insert("blogPosts", {
        title: "Deleted Post",
        slug: "deleted",
        content: "Gone",
        status: "published",
        orgId: "org_1",
        isDeleted: true,
      });
    });

    const posts = await asOrg.query(api.public.queries.listBlogPosts, {
      orgSlug: "blog-org",
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Published Post");
  });

  it("listBlogPosts returns featuredImageUrl as null when no image set", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_bi",
        orgSlug: "bi-org",
        siteName: "BI Org",
      });
      await ctx.db.insert("blogPosts", {
        title: "No Image Post",
        slug: "no-image",
        content: "Text only",
        status: "published",
        orgId: "org_bi",
        isDeleted: false,
      });
    });

    const posts = await asOrg.query(api.public.queries.listBlogPosts, {
      orgSlug: "bi-org",
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toHaveProperty("featuredImageUrl");
    expect(posts[0].featuredImageUrl).toBeNull();
  });

  it("getBlogPost returns featuredImageUrl as null when no image set", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_bp",
        orgSlug: "bp-org",
        siteName: "BP Org",
      });
      await ctx.db.insert("blogPosts", {
        title: "Detail Post",
        slug: "detail-post",
        content: "Full content",
        status: "published",
        orgId: "org_bp",
        isDeleted: false,
      });
    });

    const post = await asOrg.query(api.public.queries.getBlogPost, {
      orgSlug: "bp-org",
      slug: "detail-post",
    });
    expect(post).not.toBeNull();
    expect(post!).toHaveProperty("featuredImageUrl");
    expect(post!.featuredImageUrl).toBeNull();
  });

  it("getBlogPost returns null for non-existent slug", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_nf2",
        orgSlug: "nf2-org",
        siteName: "NF2 Org",
      });
    });

    const post = await asOrg.query(api.public.queries.getBlogPost, {
      orgSlug: "nf2-org",
      slug: "nonexistent",
    });
    expect(post).toBeNull();
  });

  it("getHomepageData recentPosts include featuredImageUrl", async () => {
    const t = convexTest(schema, modules);
      const asOrg = t.withIdentity({ subject: "test_user", orgId: "org_1" });

    await t.run(async (ctx) => {
      await ctx.db.insert("tenantBranding", {
        orgId: "org_rp",
        orgSlug: "rp-org",
        siteName: "RP Org",
      });
      await ctx.db.insert("blogPosts", {
        title: "Recent Post",
        slug: "recent",
        content: "Content",
        status: "published",
        orgId: "org_rp",
        isDeleted: false,
      });
    });

    const result = await asOrg.query(api.public.queries.getHomepageData, {
      orgSlug: "rp-org",
      now: Date.now(),
    });
    expect(result).not.toBeNull();
    expect(result!.recentPosts).toHaveLength(1);
    expect(result!.recentPosts[0]).toHaveProperty("featuredImageUrl");
    expect(result!.recentPosts[0].featuredImageUrl).toBeNull();
  });
});
