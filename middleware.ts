import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./lib/auth/jwt";

const handleI18n = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and internal Next.js requests bypass
  if (
    pathname.startsWith("/api/photos") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if pathname matches locale prefix (e.g. /en/... or /ar/...)
  const localeMatch = pathname.match(/^\/(en|ar)(\/.*)?$/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const pathWithoutLocale = localeMatch ? localeMatch[2] || "/" : pathname;

  const isPublicRoute = pathWithoutLocale === "/login";

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;

  // If user is already authenticated and tries to visit login, redirect to sections
  if (user && pathWithoutLocale === "/login") {
    return NextResponse.redirect(new URL(`/${locale}/sections`, request.url));
  }

  // If user is not authenticated and attempts to access protected routes or root
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // If authenticated and accesses root (e.g. / or /en or /ar), redirect to sections
  if (user && pathWithoutLocale === "/") {
    return NextResponse.redirect(new URL(`/${locale}/sections`, request.url));
  }

  return handleI18n(request);
}

export const config = {
  // Match internationalized pathnames, ignore api, _next, static assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
