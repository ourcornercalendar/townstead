import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const ORG = "test_org";

describe("upsertOrgSettings", () => {
  it("creates settings when none exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    const id = await t.mutation(api.settings.mutations.upsertOrgSettings, {
      orgId: ORG,
      businessName: "New Business",
      phone: "555-0000",
    });

    expect(id).toBeDefined();

    const result = await t.query(api.settings.queries.getOrgSettings, {
      orgId: ORG,
    });

    expect(result).not.toBeNull();
    expect(result!.businessName).toBe("New Business");
    expect(result!.phone).toBe("555-0000");
  });

  it("updates existing settings", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    await t.mutation(api.settings.mutations.upsertOrgSettings, {
      orgId: ORG,
      businessName: "Original Name",
    });

    await t.mutation(api.settings.mutations.upsertOrgSettings, {
      orgId: ORG,
      businessName: "Updated Name",
      email: "new@email.com",
    });

    const result = await t.query(api.settings.queries.getOrgSettings, {
      orgId: ORG,
    });

    expect(result).not.toBeNull();
    expect(result!.businessName).toBe("Updated Name");
    expect(result!.email).toBe("new@email.com");
  });

  it("stores address and remit-to address", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "test_org" });

    await t.mutation(api.settings.mutations.upsertOrgSettings, {
      orgId: ORG,
      businessName: "With Address",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
      remitToName: "Town Planner",
      remitToAddress: {
        street: "P.O. Box 188",
        city: "Elk Grove",
        state: "CA",
        zip: "95759",
      },
    });

    const result = await t.query(api.settings.queries.getOrgSettings, {
      orgId: ORG,
    });

    expect(result!.address!.street).toBe("123 Main St");
    expect(result!.address!.city).toBe("Springfield");
    expect(result!.remitToName).toBe("Town Planner");
    expect(result!.remitToAddress!.street).toBe("P.O. Box 188");
  });

  it("tenant isolation — upsert for org A does not affect org B", async () => {
    const base = convexTest(schema, modules);
    const asA = base.withIdentity({ subject: "user_a", orgId: "org_a" });
    const asB = base.withIdentity({ subject: "user_b", orgId: "org_b" });

    await asA.mutation(api.settings.mutations.upsertOrgSettings, {
      orgId: "org_a",
      businessName: "Org A",
    });

    await asB.mutation(api.settings.mutations.upsertOrgSettings, {
      orgId: "org_b",
      businessName: "Org B",
    });

    const resultA = await asA.query(api.settings.queries.getOrgSettings, {
      orgId: "org_a",
    });
    const resultB = await asB.query(api.settings.queries.getOrgSettings, {
      orgId: "org_b",
    });

    expect(resultA!.businessName).toBe("Org A");
    expect(resultB!.businessName).toBe("Org B");
  });
});
