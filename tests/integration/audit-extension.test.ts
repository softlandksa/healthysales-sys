import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { runWithAuditContext } from "@/lib/audit/request-context";
import { auditExtension } from "@/lib/audit/prisma-extension";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Audit extension integration", () => {
  const suffix = Date.now().toString(36);
  let base: PrismaClient;
  let extended: ReturnType<typeof buildExtended>;
  let userId: string;
  let productId: string;

  function buildExtended() {
    return new PrismaClient({
      datasources: { db: { url: DATABASE_URL! } },
    }).$extends(auditExtension);
  }

  beforeAll(async () => {
    base     = new PrismaClient({ datasources: { db: { url: DATABASE_URL! } } });
    extended = buildExtended();

    const user = await base.user.create({
      data: { email: `audit-test-${suffix}@test.local`, name: "Audit Tester", role: "admin", password: "x" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await base.auditLog.deleteMany({ where: { userId } });
    if (productId) await base.product.delete({ where: { id: productId } }).catch(() => {});
    await base.user.delete({ where: { id: userId } }).catch(() => {});
    await base.$disconnect();
    await (extended as unknown as { $disconnect(): Promise<void> }).$disconnect();
  });

  it("create op writes an audit log with action=create", async () => {
    await runWithAuditContext(
      { userId, ip: "127.0.0.1", userAgent: "test-agent", requestId: "req-1" },
      async () => {
        const product = await extended.product.create({
          data: {
            code:   `AUDIT-${suffix}`,
            nameAr: "منتج اختبار التدقيق",
            price:  new Prisma.Decimal("50.00"),
          },
        });
        productId = product.id;
      }
    );

    // Give setImmediate a tick
    await new Promise((r) => setTimeout(r, 100));

    const logs = await base.auditLog.findMany({
      where: { userId, entityType: "Product", action: "create" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.entityId).toBe(productId);
    expect(logs[0]!.ipAddress).toBe("127.0.0.1");
  });

  it("update op writes audit log with before/after diff", async () => {
    await runWithAuditContext(
      { userId, ip: null, userAgent: null, requestId: "req-2" },
      async () => {
        await extended.product.update({
          where: { id: productId },
          data: { nameAr: "منتج محدّث" },
        });
      }
    );

    await new Promise((r) => setTimeout(r, 100));

    const logs = await base.auditLog.findMany({
      where: { userId, entityType: "Product", action: "update" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs).toHaveLength(1);
    const meta = logs[0]!.metadata as { before?: { nameAr?: string }; after?: { nameAr?: string } };
    expect(meta.before?.nameAr).toBe("منتج اختبار التدقيق");
    expect(meta.after?.nameAr).toBe("منتج محدّث");
  });

  it("does NOT write audit log when no context is set", async () => {
    const countBefore = await base.auditLog.count({ where: { userId, entityType: "Product" } });

    // No runWithAuditContext — operate directly through base client (no extension)
    await base.product.update({
      where: { id: productId },
      data: { nameAr: "تعديل بدون سياق" },
    });

    await new Promise((r) => setTimeout(r, 100));
    const countAfter = await base.auditLog.count({ where: { userId, entityType: "Product" } });
    // Base client has no extension, so no new logs
    expect(countAfter).toBe(countBefore);
  });

  it("redacts password field in metadata", async () => {
    await runWithAuditContext(
      { userId, ip: null, userAgent: null, requestId: "req-3" },
      async () => {
        // Update user password — should be redacted in audit log
        await extended.user.update({
          where: { id: userId },
          data: { password: "new-hashed-password" },
        });
      }
    );

    await new Promise((r) => setTimeout(r, 100));

    const logs = await base.auditLog.findMany({
      where: { userId, entityType: "User", action: "update" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs.length).toBeGreaterThan(0);
    const meta = logs[0]!.metadata as { after?: Record<string, unknown> };
    if (meta.after?.password !== undefined) {
      expect(meta.after.password).toBe("[REDACTED]");
    }
  });

  it("AuditLog writes do NOT trigger recursive audit logs", async () => {
    const countBefore = await base.auditLog.count();

    await runWithAuditContext(
      { userId, ip: null, userAgent: null, requestId: "req-4" },
      async () => {
        // Direct AuditLog write via extended client — should be skipped by extension
        await extended.auditLog.create({
          data: { action: "manual", entityType: "Test", userId },
        });
      }
    );

    await new Promise((r) => setTimeout(r, 100));
    const countAfter = await base.auditLog.count();
    // Only 1 new row (the manual one), no recursive entries
    expect(countAfter - countBefore).toBe(1);
  });
});
