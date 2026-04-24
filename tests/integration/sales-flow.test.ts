import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Sales flow integration", () => {
  let prisma: PrismaClient;

  // Test-scoped IDs to avoid collision
  const testSuffix = Date.now().toString(36);
  let userId: string;
  let customerId: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL! } } });

    // Create minimal fixtures
    const user = await prisma.user.create({
      data: {
        email: `test-rep-${testSuffix}@test.local`,
        name: "Test Rep",
        role: "sales_rep",
        password: "hashed",
      },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: {
        code: `TEST-${testSuffix}`,
        nameAr: `عميل اختبار ${testSuffix}`,
        balance: new Prisma.Decimal(0),
        openingBalance: new Prisma.Decimal(0),
      },
    });
    customerId = customer.id;

    const product = await prisma.product.create({
      data: {
        code: `PROD-${testSuffix}`,
        nameAr: `منتج اختبار ${testSuffix}`,
        unit: "كرتون",
        price: new Prisma.Decimal("100.00"),
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup in dependency order
    if (orderId) {
      await prisma.salesOrderItem.deleteMany({ where: { orderId } });
      await prisma.salesOrder.delete({ where: { id: orderId } }).catch(() => {});
    }
    await prisma.customerTransaction.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("draft order does NOT touch customer balance", async () => {
    const before = await prisma.customer.findUnique({ where: { id: customerId }, select: { balance: true } });

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.salesOrder.create({
        data: {
          code: `SO-TEST-${testSuffix}`,
          status: "draft",
          subtotal: new Prisma.Decimal("200.00"),
          discount: new Prisma.Decimal("0"),
          total: new Prisma.Decimal("200.00"),
          repId: userId,
          customerId,
          items: {
            create: [{
              productId,
              quantity: 2,
              unitPrice: new Prisma.Decimal("100.00"),
              lineTotal: new Prisma.Decimal("200.00"),
              expiryDate: new Date("2027-01-01"),
            }],
          },
        },
      });
      return o;
    });

    orderId = order.id;

    const after = await prisma.customer.findUnique({ where: { id: customerId }, select: { balance: true } });
    expect(after!.balance.toFixed(2)).toBe(before!.balance.toFixed(2));
  });

  it("confirming order increments customer balance", async () => {
    const before = await prisma.customer.findUnique({ where: { id: customerId }, select: { balance: true } });
    const orderTotal = new Prisma.Decimal("200.00");

    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({ where: { id: orderId }, data: { status: "confirmed", confirmedAt: new Date() } });
      const newBalance = before!.balance.add(orderTotal);
      await tx.customerTransaction.create({
        data: {
          customerId,
          type: "sale",
          amount: orderTotal,
          balance: newBalance,
          description: `مبيعات — ${orderId}`,
          referenceType: "sales_order",
          referenceId: orderId,
          createdById: userId,
        },
      });
      await tx.customer.update({ where: { id: customerId }, data: { balance: newBalance } });
    });

    const after = await prisma.customer.findUnique({ where: { id: customerId }, select: { balance: true } });
    expect(after!.balance.toFixed(2)).toBe("200.00");

    // Balance invariant: balance == SUM(transactions)
    const sum = await prisma.customerTransaction.aggregate({
      where: { customerId },
      _sum: { amount: true },
    });
    expect(sum._sum.amount?.toFixed(2)).toBe(after!.balance.toFixed(2));
  });

  it("cancelling confirmed order reverses balance", async () => {
    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { balance: true } });
      const order = await tx.salesOrder.findUnique({ where: { id: orderId }, select: { total: true } });
      const newBalance = customer!.balance.sub(order!.total);

      await tx.salesOrder.update({ where: { id: orderId }, data: { status: "cancelled", cancelledAt: new Date() } });
      await tx.customerTransaction.create({
        data: {
          customerId,
          type: "adjustment",
          amount: order!.total.negated(),
          balance: newBalance,
          description: `إلغاء طلب — ${orderId}`,
          referenceType: "sales_order",
          referenceId: orderId,
          createdById: userId,
        },
      });
      await tx.customer.update({ where: { id: customerId }, data: { balance: newBalance } });
    });

    const after = await prisma.customer.findUnique({ where: { id: customerId }, select: { balance: true } });
    expect(after!.balance.toFixed(2)).toBe("0.00");

    // Invariant check
    const sum = await prisma.customerTransaction.aggregate({
      where: { customerId },
      _sum: { amount: true },
    });
    expect(sum._sum.amount?.toFixed(2) ?? "0.00").toBe("0.00");
  });
});
