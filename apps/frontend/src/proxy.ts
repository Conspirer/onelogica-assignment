import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefix = "/workspace";

export function proxy(request: NextRequest) {
  const isProtectedRoute = request.nextUrl.pathname.startsWith(protectedPrefix);
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("onelogica_session")?.value;
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*"],
};
