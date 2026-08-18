import { NextResponse, type NextRequest } from "next/server";
import { BIDDER_COOKIE } from "@/lib/session";

/**
 * Stands in for authentication, which the brief explicitly does not require.
 *
 * A bid still has to belong to *someone* or the UI cannot distinguish "you are
 * the high bidder" from "you have been outbid" — and that distinction is most
 * of what makes a bidding interface feel real. So every browser gets a stable
 * random id on first request. Setting it here rather than in client JS means
 * server components can read it during render, so bid state is correct in the
 * first paint instead of flickering in afterwards.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(BIDDER_COOKIE)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(BIDDER_COOKIE, crypto.randomUUID(), {
    // Only server components and the bid route handler read this — no client
    // code touches document.cookie — so there is no reason to expose it to JS.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
