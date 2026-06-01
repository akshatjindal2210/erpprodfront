import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/core/utils/lib";

const PROTECTED_PREFIXES = ["/home", "/ims", "/settings", "/task"];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Legacy `/dashboard/*` → `/ims/dashboard/*` (users still go to settings). */
function legacyDashboardRedirect(pathname, requestUrl) {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (pathname === "/dashboard/users") {
      return new URL(`/settings`, requestUrl);
    }
    if (pathname.startsWith("/dashboard/users/")) {
      const suffix = pathname.slice("/dashboard/users".length);
      return new URL(`/settings/users${suffix}`, requestUrl);
    }
    const dest = pathname.replace(/^\/dashboard/, "/ims/dashboard");
    return new URL(dest, requestUrl);
  }
  return null;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  const legacy = legacyDashboardRedirect(pathname, request.url);
  if (legacy) {
    return NextResponse.redirect(legacy);
  }

  const isAuthPage = pathname.startsWith("/login");
  const protectedPath = isProtectedPath(pathname);

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(token ? "/home" : "/login", request.url)
    );
  }

  if (!token && protectedPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login/:path*",
    "/home/:path*",
    "/dashboard/:path*",
    "/ims/:path*",
    "/settings/:path*",
    "/task/:path*",
  ],
};

