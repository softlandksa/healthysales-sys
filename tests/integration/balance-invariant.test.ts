import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma, type TransactionType } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Balance invariant — 200 random ops", () => {
  let prisma: PrismaClient;
  const testSuffix = `inv-${Date.now().toString(36)}`;
  let userId: string;
  let customerId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL! } } });

    const user = await prisma.user.create({
      data: {
        email: `inv-rep-${testSuffix}@test.local`,
        name: "Invariant Test Rep",
        role: "sales_rep",
        password: "hashed",
      },
    });
    userId = user.id;

    const customer = await prisma.customer.create({
      data: {
        code: `INV-${testSuffix}`,
        nameAr: `عميل ثبات ${testSuffix}`,
        balance: new Prisma.Decimal(0),
        openingBalance: new Prisma.Decimal(0),
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.customerTransaction.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("invariant holds after 200 random transactions", async () => {
    const OPS = 200;

    for (let i = 0; i < OPS; i++) {
      const isSale = Math.random() > 0.4;
      const amount = new Prisma.Decimal((Math.random() * 1000 + 1).toFixed(2));

      await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { balance: true } });
        const currentBalance = customer!.balance;

        let newBalance: Prisma.Decimal;
        let type: TransactionType;
        let txAmount: Prisma.Decimal;

        if (isSale) {
          newBalance = currentBalance.add(amount);
          type = "sale";
          txAmount = amount;
        } else {
          newBalance = currentBalance.sub(amount);
          type = "collection";
          txAmount = amount.negated();
        }

        await tx.customerTransaction.create({
          data: {
            customerId,
            type,
            amount: txAmount,
            balance: newBalance,
            description: `op-${i}`,
            createdById: userId,
          },
        });

        await tx.customer.update({ where: { id: customerId }, data: { balance: newBalance } });
      });
    }

    // Verify invariant: customer.balance == SUM(transactions.amount)
    const [customer, sum] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId }, select: { balance: true } }),
      prisma.customerTransaction.aggregate({
        where: { customerId },
        _sum: { amount: true },
      }),
    ]);

    const customerBalance = customer!.balance.toFixed(2);
    const transactionSum = (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2);

    expect(customerBalance).toBe(transactionSum);
  }, 60_000);
});
