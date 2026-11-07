import { isLoginLocked, LOGIN_WINDOW_MS } from "@/lib/loginLimit";
import { db } from "./db";
import { getDummyHash, verifyPassword } from "./password";

export type SignInResult = { ok: true; staffId: string } | { ok: false; reason: "invalid" | "locked" };

/**
 * Checks staff credentials and records the attempt.
 * Unknown email and wrong password give the same answer, in the same time.
 */
export async function signInStaff(email: string, password: string): Promise<SignInResult> {
  const now = new Date();

  const recent = await db.staffLoginAttempt.findMany({
    where: { email, at: { gt: new Date(now.getTime() - LOGIN_WINDOW_MS) } },
    select: { succeeded: true, at: true },
  });
  // A locked attempt isn't recorded, so the lock lifts 15 minutes after the
  // last failure no matter how often someone keeps trying.
  if (isLoginLocked(recent, now)) return { ok: false, reason: "locked" };

  const staff = await db.staffUser.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const passwordMatches = await verifyPassword(password, staff?.passwordHash ?? (await getDummyHash()));
  const succeeded = staff !== null && passwordMatches;

  await db.staffLoginAttempt.create({ data: { email, succeeded } });

  return succeeded ? { ok: true, staffId: staff.id } : { ok: false, reason: "invalid" };
}
