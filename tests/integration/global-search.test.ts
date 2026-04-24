import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { globalSearch } from "@/lib/search/global-search";
import type { SessionUser } from "@/types";

const DATABASE_URL = process.env.DATABASE_URL;

function makeUser(overrides: Partial<SessionUser> & { id: string; role: SessionUser["role"] }): SessionUser {
  return {
    name: "Test",
    email: "test@test.local",
    teamId: null,
    managerId: null,
    ...overrides,
  };
}

describe.skipIf(!DATABASE_URL)("Global search integration", () => {
  const suffix = Date.now().toString(36);
  let prisma: PrismaClient;
  let repId:      string;
  let otherRepId: string;
  let customerId: string;
  let productId:  string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL! } } });

    const rep = await prisma.user.create({
      data: { email: `search-rep-${suffix}@test.local`, name: `مندوب بحث ${suffix}`, role: "sales_rep", password: "x" },
    });
    repId = rep.id;

    const otherRep = await prisma.user.create({
      data: { email: `search-other-${suffix}@test.local`, name: "Other Rep", role: "sales_rep", password: "x" },
    });
    otherRepId = otherRep.id;

    const customer = await prisma.customer.create({
      data: {
        code:         `SRCH-${suffix}`,
        nameAr:       `عميل البحث ${suffix}`,
        balance:       new Prisma.Decimal(0),
        openingBalance: new Prisma.Decimal(0),
        assignedToId:  repId,
      },
    });
    customerId = customer.id;

    const product = await prisma.product.create({
      data: { code: `PSCH-${suffix}`, nameAr: `منتج البحث ${suffix}`, price: new Prisma.Decimal("10.00") },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [repId, otherRepId] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("finds customer by Arabic name for the owning rep", async () => {
    const user    = makeUser({ id: repId, role: "sales_rep" });
    const results = await globalSearch(`عميل البحث`, user);
    const found   = results.customers.find((c) => c.id === customerId);
    expect(found).toBeDefined();
    expect(found?.title).toContain("عميل البحث");
  });

  it("finds product by Arabic name (no RBAC filter on products)", async () => {
    const user    = makeUser({ id: repId, role: "sales_rep" });
    const results = await globalSearch(`منتج البحث`, user);
    const found   = results.products.find((p) => p.id === productId);
    expect(found).toBeDefined();
  });

  it("does NOT return customer to unrelated rep", async () => {
    // otherRep has no access to repId's customers
    const user    = makeUser({ id: otherRepId, role: "sales_rep" });
    const results = await globalSearch(`عميل البحث ${suffix}`, user);
    const found   = results.customers.find((c) => c.id === customerId);
    expect(found).toBeUndefined();
  });

  it("returns empty for short query (<2 chars)", async () => {
    const user    = makeUser({ id: repId, role: "sales_rep" });
    const results = await globalSearch("ع", user);
    expect(results.customers).toHaveLength(0);
    expect(results.products).toHaveLength(0);
  });

  it("returns empty for completely unmatched query", async () => {
    const user    = makeUser({ id: repId, role: "sales_rep" });
    const results = await globalSearch("xyz_no_match_ever_zzz", user);
    expect(results.customers).toHaveLength(0);
    expect(results.products).toHaveLength(0);
  });

  it("sales_rep search does not include user results", async () => {
    const user    = makeUser({ id: repId, role: "sales_rep" });
    const results = await globalSearch("مندوب", user);
    // sales_reps always get empty user results
    expect(results.users).toHaveLength(0);
  });

  it("admin search can find user by name", async () => {
    const admin = makeUser({ id: repId, role: "admin" }); // reuse repId but as admin context
    const results = await globalSearch(`مندوب بحث ${suffix}`, admin);
    // Admin has all user IDs in scope; may return the rep
    const found = results.users.find((u) => u.id === repId);
    expect(found).toBeDefined();
  });
});
