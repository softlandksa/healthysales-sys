import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { SessionUser, UserRole } from "@/types";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    role: session.user.role,
    teamId: session.user.teamId,
    managerId: session.user.managerId,
    image: session.user.image ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/ar/login");
  return user;
}

export async function requireRole(
  roles: UserRole[],
  user?: SessionUser
): Promise<SessionUser> {
  const currentUser = user ?? (await requireUser());
  if (!roles.includes(currentUser.role)) {
    redirect("/ar/403");
  }
  return currentUser;
}
