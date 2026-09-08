/**
 * Task 1.4 — first-party campaign attribution (UTM) capture.
 *
 * Privacy model (per docs/PROJECT_PLAN.md §13, §14 and Task 1.4 authorization):
 * - First-party only: values captured from the URL and kept in localStorage on
 *   the visitor's own device. No cookies, no third parties, no fingerprinting.
 * - First-touch: the FIRST campaign attribution is preserved and never
 *   overwritten by later visits.
 * - Everything is treated as untrusted: parsed, charset/length constrained,
 *   and re-validated server-side before persistence.
 * - Nothing is invented: when parameters are absent, attribution is null.
 */

export const ATTRIBUTION_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export const ATTRIBUTION_STORAGE_KEY = "neolife.attribution";

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landingPage?: string;
  /** Derived from the validated first-touch utm_source — never client-supplied directly. */
  firstTouchSource?: string;
};

const MAX_ATTRIBUTION_LENGTH = 120;
const MAX_LANDING_PAGE_LENGTH = 200;

// Conservative charset: no newlines/control chars (log-injection safe), no
// angle brackets or quotes (XSS-safe even if ever rendered raw).
const SAFE_ATTRIBUTION = /^[A-Za-z0-9 _\-./+:()%]{1,120}$/;
const SAFE_LANDING_PAGE = /^\/[A-Za-z0-9 _\-./%]{0,199}$/;

function constrain(value: string): string | undefined {
  const trimmed = value.trim().slice(0, MAX_ATTRIBUTION_LENGTH);
  return SAFE_ATTRIBUTION.test(trimmed) ? trimmed : undefined;
}

/** Extracts the first-party attribution from a URLSearchParams instance. */
export function parseAttributionFromSearchParams(
  params: URLSearchParams,
): Attribution | null {
  const raw = (key: string) => params.get(key) ?? undefined;
  return parseAttribution({
    source: raw("utm_source"),
    medium: raw("utm_medium"),
    campaign: raw("utm_campaign"),
    content: raw("utm_content"),
    term: raw("utm_term"),
  });
}

/**
 * Validates untrusted attribution input. Invalid individual values are safely
 * dropped (never invented); returns null when nothing valid remains.
 */
export function parseAttribution(input: {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  content?: unknown;
  term?: unknown;
  landingPage?: unknown;
}): Attribution | null {
  const result: Attribution = {};
  let found = false;

  const assign = (key: keyof Attribution, value: unknown, max: number) => {
    if (typeof value !== "string") return;
    const constrained =
      key === "landingPage"
        ? (() => {
            const trimmed = value.trim().slice(0, max);
            return SAFE_LANDING_PAGE.test(trimmed) ? trimmed : undefined;
          })()
        : constrain(value);
    if (constrained) {
      result[key] = constrained;
      found = true;
    }
  };

  assign("source", input.source, MAX_ATTRIBUTION_LENGTH);
  assign("medium", input.medium, MAX_ATTRIBUTION_LENGTH);
  assign("campaign", input.campaign, MAX_ATTRIBUTION_LENGTH);
  assign("content", input.content, MAX_ATTRIBUTION_LENGTH);
  assign("term", input.term, MAX_ATTRIBUTION_LENGTH);
  assign("landingPage", input.landingPage, MAX_LANDING_PAGE_LENGTH);

  return found ? result : null;
}

/**
 * First-touch resolution: an existing stored attribution always wins.
 * Later campaign visits NEVER overwrite the original acquisition source.
 */
export function resolveFirstTouch(
  existing: Attribution | null,
  incoming: Attribution | null,
): Attribution | null {
  return existing ?? incoming;
}

/** Serializes attribution for localStorage (safe JSON, {} when empty). */
export function serializeAttribution(attribution: Attribution | null): string {
  return JSON.stringify(attribution ?? {});
}

/** Parses localStorage content back into validated attribution (never trusts storage). */
export function deserializeAttribution(raw: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    return parseAttribution({
      source: obj.source,
      medium: obj.medium,
      campaign: obj.campaign,
      content: obj.content,
      term: obj.term,
      landingPage: obj.landingPage,
    });
  } catch {
    return null;
  }
}
