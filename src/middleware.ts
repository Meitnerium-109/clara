import { NextResponse, type NextRequest } from "next/server";
import { sessionKey, STAFF_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * First gate for /staff/*: no valid staff cookie → sent to the sign-in page.
 * This only checks the signature (fast, no database). Each staff page and
 * action still calls requireStaff(), so security never rests on this file alone.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(STAFF_COOKIE)?.value;
  const staffId = await verifySessionToken(token, "staff", sessionKey(process.env.SESSION_SECRET));
  const onLoginPage = request.nextUrl.pathname === "/staff/login";

  if (onLoginPage) {
    return staffId ? NextResponse.redirect(new URL("/staff", request.url)) : NextResponse.next();
  }
  if (!staffId) {
    return NextResponse.redirect(new URL("/staff/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/:path*"],
};
