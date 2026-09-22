import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const ORG_A = "org_a";
const ORG_B = "org_b";

describe("getOrgSettings", () => {
  it("returns null when no settings exist", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    const result = await t.query(api.settings.queries.getOrgSettings, {
      orgId: ORG_A,
    });

    expect(result).toBeNull();
  });

  it("returns settings for the org", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_a" });

    await t.run(async (ctx) => {
      await ctx.db.insert("orgSettings", {
        businessName: "Acme Publishing",
        phone: "555-1234",
        email: "info@acme.com",
        publisherName: "John Smith",
        orgId: ORG_A,
      });
    });

    const result = await t.query(api.settings.queries.getOrgSettings, {
      orgId: ORG_A,
    });

    expect(result).not.toBeNull();
    expect(result!.businessName).toBe("Acme Publishing");
    expect(result!.phone).toBe("555-1234");
    expect(result!.publisherName).toBe("John Smith");
  });

  it("tenant isolation — org B cannot see org A settings", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "test_user", orgId: "org_b" });

    await t.run(async (ctx) => {
      await ctx.db.insert("orgSettings", {
        businessName: "Org A Business",
        orgId: ORG_A,
      });
    });

    const result = await t.query(api.settings.queries.getOrgSettings, {
      orgId: ORG_B,
    });

    expect(result).toBeNull();
  });
});
