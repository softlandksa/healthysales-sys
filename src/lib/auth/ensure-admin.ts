import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL    = "kamel@prameg.net";
const ADMIN_PASSWORD = "Kamel$123";
const ADMIN_NAME     = "كامل";

export async function ensureAdminUser(): Promise<void> {
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
      console.log("[auth] Admin user created:", ADMIN_EMAIL);
    } else if (existing.role !== "admin" || !existing.isActive) {
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { role: "admin", isActive: true },
      });
      console.log("[auth] Admin user updated:", ADMIN_EMAIL);
    }
  } catch (err) {
    // Non-fatal: DB may not be reachable at cold start on Vercel
    console.error("[auth] Could not ensure admin user:", err);
  }
}
