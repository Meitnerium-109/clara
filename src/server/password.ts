import bcrypt from "bcryptjs";

// Cost 12 ≈ a quarter of a second per hash: slow for an attacker trying
// millions of guesses, unnoticeable for one person signing in.
const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when the email doesn't exist, so "no such user" takes as
// long as "wrong password" and response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}
