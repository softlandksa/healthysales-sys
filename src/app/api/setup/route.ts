import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL    = "kamel@prameg.net";
const ADMIN_NAME     = "كامل";
const ADMIN_PASSWORD = "Kamel$123";
const DUP_EMAIL      = "kamel@prameg.one";

/**
 * GET /api/setup
 *
 * Idempotent — safe to call on every deployment.
 *
 * What it does:
 *  1. Upserts kamel@prameg.net as the sole active admin (always re-hashes password).
 *  2. Deactivates every other user (isActive = false) so only the admin can log in.
 *     Note: users are deactivated, not deleted, to preserve linked business data
 *     (visits, sales orders, collections, tasks, etc.).
 *
 * Returns: { status: "admin_ready", email: "kamel@prameg.net" }
 */
export async function GET() {
  const checks: Record<string, string> = {};
  checks.auth_secret  = process.env.AUTH_SECRET  ? "ok" : "MISSING";
  checks.database_url = process.env.DATABASE_URL ? "ok" : "MISSING";

  try {
    // 1. Deactivate all non-admin users (also deactivates DUP_EMAIL if it exists)
    const deactivated = await prisma.user.updateMany({
      where: { email: { not: ADMIN_EMAIL } },
      data:  { isActive: false },
    });

    // 2. Upsert admin — always refresh password hash
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.user.upsert({
      where:  { email: ADMIN_EMAIL },
      create: {
        name:     ADMIN_NAME,
        email:    ADMIN_EMAIL,
        password: hashed,
        role:     "admin",
        isActive: true,
      },
      update: {
        name:     ADMIN_NAME,
        password: hashed,
        role:     "admin",
        isActive: true,
      },
    });

    // 3. Delete duplicate account (best-effort; deactivated above if FK constraints block deletion)
    let dupAction = "not_found";
    try {
      const deleted = await prisma.user.deleteMany({ where: { email: DUP_EMAIL } });
      dupAction = deleted.count > 0 ? "deleted" : "not_found";
    } catch {
      dupAction = "deactivated_only"; // FK constraints prevent deletion
    }

    return NextResponse.json({
      ok:               true,
      status:           "admin_ready",
      email:            ADMIN_EMAIL,
      deactivatedCount: deactivated.count,
      dupAccount:       dupAction,
      checks,
      next:             "Login at /ar/login",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status:  "error",
        message,
        checks,
        hint: message.includes("does not exist")
          ? "The `users` table does not exist. Run `pnpm db:push` to apply the schema."
          : "Check DATABASE_URL and AUTH_SECRET in Vercel environment variables.",
      },
      { status: 500 }
    );
  }
}
