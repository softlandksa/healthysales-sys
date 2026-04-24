import type { NextAuthConfig, Session, User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@/types";

function pick<T>(obj: unknown, key: string): T | null {
  if (obj && typeof obj === "object" && key in obj) {
    return (obj as Record<string, unknown>)[key] as T;
  }
  return null;
}

// Edge-compatible config — NO bcrypt, NO Prisma adapter
export const edgeAuthConfig = {
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/ar/login",
    error: "/ar/login",
  },
  providers: [],
  callbacks: {
    jwt({
      token,
      user,
    }: {
      token: JWT;
      user?: User | AdapterUser;
    }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = (pick<UserRole>(user, "role") ?? "sales_rep") as UserRole;
        token.teamId = pick<string>(user, "teamId");
        token.managerId = pick<string>(user, "managerId");
      }
      return token;
    },
    session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }) {
      session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
      session.user.role = (token.role as UserRole | undefined) ?? "sales_rep";
      session.user.teamId = (token.teamId as string | null | undefined) ?? null;
      session.user.managerId = (token.managerId as string | null | undefined) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
