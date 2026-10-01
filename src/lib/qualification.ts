/**
 * Phase D — qualification continuation token (D-030).
 *
 * Security properties:
 * - Cryptographically signed (HMAC-SHA256 using BETTER_AUTH_SECRET).
 * - Binds to exactly one Lead (cannot substitute another leadId).
 * - Short expiration (1 hour default).
 * - Single-use enforcement is durable (DB-backed, survives restarts/processes).
 * - No Lead PII in the token (only leadId, expiresAt, nonce encoded).
 * - Atomic consumption via DB transaction prevents race conditions.
 *
 * Token format: <leadId>.<expiresAt>.<nonce>.<signature>
 * - leadId: UUID string (not PII, just an internal identifier)
 * - expiresAt: Unix timestamp (seconds)
 * - nonce: random UUID (matches DB nonce column)
 * - signature: HMAC-SHA256 of "<leadId>.<expiresAt>.<nonce>"
 *
 * IMPORTANCE: The pure validation functions (parseToken, verifyTokenSignature,
 * isTokenStructurallyValid, parseQualificationInput) are re-exported from
 * `qualification-client.ts` — they do NOT import Prisma or call sign() and are
 * client-safe. The authoritative DB-backed checks (generateQualificationToken,
 * consumeQualificationToken, validateQualificationToken) import Prisma and
 * are server-only.
 */

import { prisma } from "@/server/db/prisma";
import {
  parseToken,
  TOKEN_EXPIRY_SECONDS,
  SIGNATURE_ALGO,
} from "./qualification-client";

// Re-export client-safe functions so callers can import from one module.
export { parseToken, verifyTokenSignature, isTokenStructurallyValid, parseQualificationInput } from "./qualification-client";

/** Returns the signing secret from environment (throws if not set). */
function getTokenSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("BETTER_AUTH_SECRET must be set (>=16 chars) for token signing");
  }
  return secret;
}

/** Signs a token payload with HMAC-SHA256. Server-side only. */
async function sign(payload: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac(SIGNATURE_ALGO, getTokenSecret()).update(payload).digest("hex");
}

/** Generates a signed, durable qualification continuation token for a lead. */
export async function generateQualificationToken(leadId: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
  const { randomUUID } = await import("node:crypto");
  const nonce = randomUUID();

  await prisma.qualificationToken.create({
    data: {
      leadId,
      nonce,
      expiresAt: new Date(expiresAt * 1000),
    },
  });

  const payload = `${leadId}.${expiresAt}.${nonce}`;
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

/**
 * Validates and atomically consumes a qualification token.
 * Returns the leadId if the token is valid, not expired, and not yet consumed.
 * Returns null if the token is invalid, expired, already consumed, or tampered.
 *
 * Consumption happens atomically: the token row is updated to set
 * consumedAt = NOW() only if consumedAt IS NULL AND expiresAt > NOW().
 * This atomic check-and-set prevents replay attacks across concurrent
 * requests and survives application restarts.
 *
 * This function is server-side only (imports Prisma).
 */
export async function consumeQualificationToken(
  token: string,
): Promise<string | null> {
  if (!token || typeof token !== "string") return null;

  const parsed = parseToken(token);
  if (!parsed) return null;

  const payload = `${parsed.leadId}.${parsed.expiresAt}.${parsed.nonce}`;
  const expectedSig = await sign(payload);
  if (parsed.signature !== expectedSig) return null;

  if (Date.now() / 1000 >= parsed.expiresAt) return null;

  const consumed = await prisma.qualificationToken.updateMany({
    where: {
      leadId: parsed.leadId,
      nonce: parsed.nonce,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  if (consumed.count !== 1) {
    return null;
  }

  const tokenRecord = await prisma.qualificationToken.findFirst({
    where: { leadId: parsed.leadId, nonce: parsed.nonce },
    select: { leadId: true },
  });

  return tokenRecord?.leadId ?? null;
}

/**
 * Validates a token without consuming it (for display purposes on the
 * qualification page). Returns the leadId if valid and unconsumed,
 * null otherwise.
 *
 * This function is server-side only (imports Prisma).
 */
export async function validateQualificationToken(
  token: string,
): Promise<string | null> {
  if (!token || typeof token !== "string") return null;

  const parsed = parseToken(token);
  if (!parsed) return null;

  const payload = `${parsed.leadId}.${parsed.expiresAt}.${parsed.nonce}`;
  const expectedSig = await sign(payload);
  if (parsed.signature !== expectedSig) return null;

  const expiresAt = parsed.expiresAt;
  if (Date.now() / 1000 >= expiresAt) return null;

  const record = await prisma.qualificationToken.findFirst({
    where: {
      leadId: parsed.leadId,
      nonce: parsed.nonce,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { leadId: true },
  });

  return record?.leadId ?? null;
}
