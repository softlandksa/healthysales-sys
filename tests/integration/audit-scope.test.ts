import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getAuditLogs } from "@/server/actions/audit";

const DATABASE_URL = process.env.DATABASE_URL;

// ─── Mock withAuth so we don't need a real HTTP session ───────────────────────
import { vi } from "vitest";

vi.mock("@/lib/rbac/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac/access")>();
  return {
    ...actual,
    withAuth: vi.fn(
      async (
        _action: unknown,
        _subject: unknown,
        handler: (user: unknown) => Promise<unknown>
      ) => {
        // Pass the mocked user set by individual tests
        return handler((globalThis as unknown as { __mockUser: unknown }).__mockUser);
      }
    ),
    getAccessibleUserIds: vi.fn(async (user: { role: string; id: string }) => {
      if (user.role === "admin") return ["user-admin", "user-gm", "user-sm", "user-rep"];
      if (user.role === "general_manager") return ["user-gm", "user-rep"];
      return [user.id];
    }),
  };
});

vi.mock("@/lib/auth/current-user", () => ({
  requireUser: vi.fn(async () => (globalThis as unknown as { __mockUser: unknown }).__mockUser),
}));

function setMockUser(user: { id: string; role: string }) {
  (globalThis as unknown as { __mockUser: unknown }).__mockUser = user;
}

describe.skipIf(!DATABASE_URL)("Audit log RBAC scope integration", () => {
  let prisma: PrismaClient;
  const suffix = Date.now().toString(36);
  let adminId: string;
  let gmId: string;
  let smId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL! } } });

    const admin = await prisma.user.create({
      data: { email: `scope-admin-${suffix}@test.local`, name: "Admin", role: "admin", password: "x" },
    });
    adminId = admin.id;

    const gm = await prisma.user.create({
      data: { email: `scope-gm-${suffix}@test.local`, name: "GM", role: "general_manager", password: "x" },
    });
    gmId = gm.id;

    const sm = await prisma.user.create({
      data: { email: `scope-sm-${suffix}@test.local`, name: "SM", role: "sales_manager", password: "x" },
    });
    smId = sm.id;

    // Seed some audit log entries
    await prisma.auditLog.createMany({
      data: [
        { action: "create", entityType: "Product", userId: adminId, entityId: "p-1" },
        { action: "update", entityType: "Customer", userId: gmId,    entityId: "c-1" },
        { action: "delete", entityType: "Visit",    userId: smId,    entityId: "v-1" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: { in: [adminId, gmId, smId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, gmId, smId] } } });
    await prisma.$disconnect();
  });

  it("admin can read audit logs", async () => {
    setMockUser({ id: adminId, role: "admin" });
    const { rows } = await getAuditLogs({});
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("general_manager can read audit logs for their subtree", async () => {
    setMockUser({ id: gmId, role: "general_manager" });
    const { rows } = await getAuditLogs({});
    // GM's accessible IDs include gmId + repId (mocked); sm is not in scope
    const smLogs = rows.filter((r) => r.userId === smId);
    expect(smLogs).toHaveLength(0);
  });

  it("sales_manager cannot access audit logs (throws)", async () => {
    setMockUser({ id: smId, role: "sales_manager" });
    await expect(getAuditLogs({})).rejects.toThrow();
  });
});
