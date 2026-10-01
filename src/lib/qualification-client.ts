/**
 * Phase D — client-safe qualification token utilities (D-030).
 *
 * This module contains ONLY pure functions that are safe for client components:
 * parseToken, verifyTokenSignature, isTokenStructurallyValid, parseQualificationInput.
 *
 * Server-only functions (generateQualificationToken, consumeQualificationToken,
 * validateQualificationToken, sign, getTokenSecret) live in `qualification.ts`
 * and use dynamic imports for Prisma and node:crypto.
 */

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
const SIGNATURE_ALGO = "sha256";

/** Splits a token string into its components. */
export function parseToken(token: string): {
  leadId: string;
  expiresAt: number;
  nonce: string;
  signature: string;
} | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [leadId, expiresAtStr, nonce, signature] = parts;
  if (!leadId || !expiresAtStr || !nonce || !signature) return null;

  const expiresAt = Number.parseInt(expiresAtStr, 10);
  if (Number.isNaN(expiresAt)) return null;

  return { leadId, expiresAt, nonce, signature };
}

/**
 * Checks if a token is structurally valid and not expired.
 * Client-safe: no DB, no Prisma, no node:crypto.
 * Used for UX pre-check only — the server always re-validates.
 */
export function verifyTokenSignature(token: string): { leadId: string } | null {
  const parsed = parseToken(token);
  if (!parsed) return null;

  if (Date.now() / 1000 >= parsed.expiresAt) return null;

  return { leadId: parsed.leadId };
}

/** Checks if a token is structurally valid and not expired. Client-safe. */
export function isTokenStructurallyValid(token: string): boolean {
  return verifyTokenSignature(token) !== null;
}

/**
 * Validates qualification input from the public qualification form.
 * All fields are optional — only provided fields are validated and updated.
 * Returns the validated data or null.
 */
export function parseQualificationInput(input: {
  notes?: unknown;
  interestType?: unknown;
  city?: unknown;
}): { notes: string | null; interestType: string | null; city: string | null } | null {
  const MAX_NOTES_LENGTH = 500;
  const MAX_CITY_LENGTH = 80;

  const result: { notes: string | null; interestType: string | null; city: string | null } = {
    notes: null,
    interestType: null,
    city: null,
  };

  if (typeof input.notes === "string") {
    const trimmed = input.notes.trim();
    if (trimmed.length > MAX_NOTES_LENGTH) return null;
    result.notes = trimmed || null;
  }

  if (input.interestType !== undefined && input.interestType !== null) {
    const validTypes = ["BUSINESS", "PRODUCT", "BOTH", "UNSURE"];
    const value = typeof input.interestType === "string" ? input.interestType.trim() : "";
    if (!validTypes.includes(value)) return null;
    result.interestType = value;
  }

  if (typeof input.city === "string") {
    const trimmed = input.city.trim();
    if (trimmed.length > MAX_CITY_LENGTH) return null;
    if (trimmed.length > 0 && !/^[A-Za-z0-9 _\-.,/'()]+$/.test(trimmed)) return null;
    result.city = trimmed || null;
  }

  return result;
}

export { TOKEN_EXPIRY_SECONDS, SIGNATURE_ALGO };
