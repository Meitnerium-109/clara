/**
 * Where to send a patient after sign-in or consent. Only our own patient
 * pages are allowed, so a crafted "?next=https://evil.example" link can't
 * bounce someone to another site after they sign in.
 */
export function safePatientNext(next: unknown): string {
  if (typeof next !== "string") return "/my";
  return /^\/my(\/[A-Za-z0-9_-]+)*$/.test(next) ? next : "/my";
}

/** Same-site path for "go back to this page" (e.g. after changing language). */
export function safeLocalPath(path: unknown): string {
  if (typeof path !== "string") return "/";
  // Must start with one slash: "//evil.example" and "/\evil" are other sites to a browser.
  return /^\/(?![/\\])[A-Za-z0-9_\-/.]*$/.test(path) ? path : "/";
}
