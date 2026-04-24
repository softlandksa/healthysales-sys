import { PrismaClient } from "@prisma/client";

const globalForPrismaBase = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

export const prismaBase =
  globalForPrismaBase.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrismaBase.prismaBase = prismaBase;
