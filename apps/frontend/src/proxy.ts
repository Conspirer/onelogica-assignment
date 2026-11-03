import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefix = "/workspace";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = pathname.startsWith(protectedPrefix);
  const sessionCookie = request.cookies.get("onelogica_session")?.value;

  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const proxy = middleware;

export const config = {
  matcher: ["/workspace/:path*"],
};
