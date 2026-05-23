import { NextResponse } from "next/server";
import { COOKIE_NAME } from "./utils/lib";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  const isAuthPage = pathname.startsWith("/login");
  const isDashboard = pathname.startsWith("/dashboard");

  // Root redirect
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(token ? "/dashboard" : "/login", request.url)
    );
  }

  // Not logged in → block dashboard
  if (!token && isDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in → block login pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login/:path*", "/dashboard/:path*"],
};