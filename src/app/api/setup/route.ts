import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "kamel@prameg.net";
const ADMIN_NAME = "كامل";
const ADMIN_PASSWORD = "Kamel$123";

/**
 * GET /api/setup
 *
 * Idempotent: creates the production admin in the `users` table.
 * Call once after each Vercel deployment.
 *
 * Prerequisite: `prisma migrate deploy` must have run (happens automatically
 * during the Vercel build via the updated `build` script in package.json).
 * If you see "table users does not exist", the migration has not run yet —
 * check that DATABASE_URL is available as a Vercel Build Environment Variable.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // Verify AUTH_SECRET is configured
  checks.auth_secret = process.env.AUTH_SECRET ? "ok" : "MISSING";
  checks.database_url = process.env.DATABASE_URL ? "ok" : "MISSING";

  try {
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true, role: true, isActive: true },
    });

    if (!existing) {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await prisma.user.create({
        data: {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          password: hashed,
          role: "admin",
          isActive: true,
        },
      });
      return NextResponse.json({
        status: "created",
        email: ADMIN_EMAIL,
        checks,
        next: "You can now login at /ar/login",
      });
    }

    // Ensure it's an active admin
    if (existing.role !== "admin" || !existing.isActive) {
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { role: "admin", isActive: true },
      });
      return NextResponse.json({
        status: "updated",
        email: ADMIN_EMAIL,
        checks,
        next: "Admin role and isActive restored. Login at /ar/login",
      });
    }

    return NextResponse.json({
      status: "exists",
      email: ADMIN_EMAIL,
      checks,
      next: "Admin already exists. Login at /ar/login",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTableMissing = message.includes("does not exist");
    return NextResponse.json(
      {
        status: "error",
        message,
        checks,
        hint: isTableMissing
          ? "The `users` table does not exist. Ensure DATABASE_URL is set as a Vercel BUILD environment variable so `prisma migrate deploy` runs during build."
          : "Check DATABASE_URL and AUTH_SECRET in Vercel environment variables.",
      },
      { status: 500 }
    );
  }
}
