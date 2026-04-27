import { PrismaClient } from "@prisma/client";
import { auditExtension } from "@/lib/audit/prisma-extension";

// DATABASE_URL must use Supabase Transaction Pooler (port 6543):
// postgresql://postgres.REF:PASS@aws-X.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log: ["error"],
  }).$extends(auditExtension) as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
