/** True only when DEMO_MODE is exactly "true": demo tools stay off by default. */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Base URL for links in messages. Required in production; localhost in development. */
export function appUrl(): string {
  const url = process.env.APP_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL must be set in production");
  return "http://localhost:3000";
}
