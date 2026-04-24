import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { edgeAuthConfig } from "@/lib/auth/edge-config";
import { locales } from "@/i18n/request";
import type { NextRequest } from "next/server";

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale: "ar",
  localePrefix: "always",
});

const { auth } = NextAuth(edgeAuthConfig);

// Paths under /[locale]/ that require authentication
const PROTECTED_SEGMENTS = [
  "dashboard",
  "users",
  "teams",
  "visits",
  "sales",
  "collections",
  "tasks",
  "competitions",
  "customers",
  "products",
  "reports",
  "targets",
  "settings",
  "audit-log",
  "notifications",
  "orders",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Intercept root, bare locale, and /login before next-intl can redirect to
  // a non-existent /ar page and produce a 404.
  if (pathname === "/" || pathname === "/ar" || pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = req.auth ? "/ar/dashboard" : "/ar/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isProtected = PROTECTED_SEGMENTS.some((seg) =>
    pathname.match(new RegExp(`/(ar)/${seg}(/|$)`))
  );

  if (isProtected && !req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/ar/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req as NextRequest);
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
