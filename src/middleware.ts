import { NextResponse, type NextRequest } from "next/server";
import {
  createSessionToken,
  PATIENT_COOKIE,
  PATIENT_IDLE_SECONDS,
  sessionCookieOptions,
  sessionKey,
  STAFF_COOKIE,
  verifySessionToken,
} from "@/lib/session";

/**
 * First gate for signed-in areas. It only checks cookie signatures (fast, no
 * database). Every page, action and route handler checks the session again
 * itself, so security never rests on this file alone.
 */
export async function middleware(request: NextRequest) {
  const key = sessionKey(process.env.SESSION_SECRET);
  return request.nextUrl.pathname.startsWith("/staff") ? staffGate(request, key) : patientGate(request, key);
}

async function staffGate(request: NextRequest, key: Uint8Array) {
  const staffId = await verifySessionToken(request.cookies.get(STAFF_COOKIE)?.value, "staff", key);
  const onLoginPage = request.nextUrl.pathname === "/staff/login";

  if (onLoginPage) {
    return staffId ? NextResponse.redirect(new URL("/staff", request.url)) : NextResponse.next();
  }
  if (!staffId) return NextResponse.redirect(new URL("/staff/login", request.url));
  return NextResponse.next();
}

async function patientGate(request: NextRequest, key: Uint8Array) {
  const { pathname } = request.nextUrl;
  const mobile = await verifySessionToken(request.cookies.get(PATIENT_COOKIE)?.value, "patient", key);
  const signedInOnly = pathname === "/my" || pathname.startsWith("/my/") || pathname === "/consent";

  if (!mobile) {
    return signedInOnly ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next();
  }
  if (pathname === "/login") return NextResponse.redirect(new URL("/my", request.url));

  // Sliding 30-minute idle timeout: each page view re-issues the cookie.
  // Only on GET: server actions (POST) set or delete the cookie themselves,
  // e.g. sign-out, and must not be overwritten here.
  const response = NextResponse.next();
  if (request.method === "GET") {
    const token = await createSessionToken(mobile, "patient", PATIENT_IDLE_SECONDS, key);
    response.cookies.set(PATIENT_COOKIE, token, sessionCookieOptions(PATIENT_IDLE_SECONDS));
  }
  return response;
}

export const config = {
  matcher: ["/staff/:path*", "/my/:path*", "/consent", "/login", "/r/:path*"],
};
