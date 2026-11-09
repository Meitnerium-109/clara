import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  createSessionToken,
  sessionCookieOptions,
  sessionKey,
  STAFF_COOKIE,
  STAFF_SESSION_SECONDS,
  verifySessionToken,
} from "@/lib/session";
import { db } from "./db";

export async function startStaffSession(staffId: string): Promise<void> {
  const token = await createSessionToken(
    staffId,
    "staff",
    STAFF_SESSION_SECONDS,
    sessionKey(process.env.SESSION_SECRET),
  );
  (await cookies()).set(STAFF_COOKIE, token, sessionCookieOptions(STAFF_SESSION_SECONDS));
}

export async function endStaffSession(): Promise<void> {
  (await cookies()).delete(STAFF_COOKIE);
}

/**
 * The signed-in staff member, or null. Middleware already checked the cookie's
 * signature; this also checks the account still exists in the database.
 * Wrapped in cache() so a layout and page in one request share one query.
 */
export const getSignedInStaff = cache(async () => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  const staffId = await verifySessionToken(token, "staff", sessionKey(process.env.SESSION_SECRET));
  if (!staffId) return null;
  return db.staffUser.findUnique({ where: { id: staffId }, select: { id: true, name: true, email: true } });
});

/** For staff pages and actions: the signed-in staff member, or a redirect to sign in. */
export async function requireStaff() {
  const staff = await getSignedInStaff();
  if (!staff) redirect("/staff/login");
  return staff;
}
