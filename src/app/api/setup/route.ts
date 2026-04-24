import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "kamel@prameg.net";
const ADMIN_NAME = "كامل";
const ADMIN_PASSWORD = "Kamel$123";

/**
 * GET /api/setup
 * Idempotent: creates the production admin user if missing, ensures role=admin
 * and isActive=true if the account already exists.
 * Safe to call multiple times — call once right after each Vercel deployment.
 */
export async function GET() {
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
      return NextResponse.json({ status: "created", email: ADMIN_EMAIL });
    }

    if (existing.role !== "admin" || !existing.isActive) {
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { role: "admin", isActive: true },
      });
      return NextResponse.json({ status: "updated", email: ADMIN_EMAIL });
    }

    return NextResponse.json({ status: "exists", email: ADMIN_EMAIL });
  } catch (err) {
    console.error("[/api/setup]", err);
    return NextResponse.json(
      { status: "error", message: String(err) },
      { status: 500 }
    );
  }
}
