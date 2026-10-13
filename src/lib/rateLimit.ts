/**
 * Minimal in-memory rate limiter for public endpoints (MVP, single instance).
 * Limitation: per-process memory only — resets on restart and does not span
 * multiple server instances. Sufficient for the Traffic MVP's abuse control.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

/**
 * E2E opt-out (same pattern as the Better Auth limiter in src/lib/auth.ts):
 * the Playwright suite legitimately exercises several public submissions
 * from one IP inside the 60s window (lead capture, referral workflow,
 * qualification continuation), which would throttle the suite spuriously.
 * E2E runs opt out explicitly via the webServer env; production is unaffected
 * and keeps the default limiter. See playwright.config.ts.
 */
const isE2ERun = process.env.E2E_DISABLE_AUTH_RATE_LIMIT === "1";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  if (isE2ERun) return false;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

/** Best-effort client key from proxy headers / loopback. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "local";
}
