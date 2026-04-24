/**
 * Runs `prisma migrate deploy` only when DATABASE_URL is available.
 * - On Vercel: DATABASE_URL is set as a build env var → migrations run.
 * - Locally without .env: skips silently so `pnpm build` still works.
 */
import { execSync } from "child_process";

if (!process.env.DATABASE_URL) {
  console.log(
    "[migrate-deploy] DATABASE_URL not found — skipping prisma migrate deploy.\n" +
      "  On Vercel, ensure DATABASE_URL is added to Build Environment Variables."
  );
  process.exit(0);
}

console.log("[migrate-deploy] Running prisma migrate deploy...");
try {
  execSync("prisma migrate deploy", { stdio: "inherit" });
} catch {
  process.exit(1);
}
