export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAdminUser } = await import("./lib/auth/ensure-admin");
    await ensureAdminUser();
  }
}
