import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/prisma";

/**
 * Staff referral links (D-034).
 *
 * Codes are 128 bits of random data, base64url-encoded, and completely
 * opaque: they never embed Better Auth user IDs. Resolution happens
 * server-side only — a public request may carry a code but never the user
 * id it wants attributed.
 */

export const REFERRAL_CODE_LENGTH = 22; // 22 base64url chars ≈ 132 bits

export const MAX_PUBLIC_NAME_LENGTH = 60;

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Cryptographically random, URL-safe, non-guessable referral code. */
export function generateReferralCode(length: number = REFERRAL_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let code = "";
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

/** Structural check on a code coming from an untrusted URL. */
export function isValidReferralCode(code: string): boolean {
  return /^[A-Za-z0-9]{17,64}$/.test(code);
}

export type ResolvedReferral = {
  userId: string;
  code: string;
  publicName: string;
  referrerName: string;
};

/**
 * Resolves a referral code to the Staff user it belongs to — only when the
 * code exists, is active (not revoked), and its owner exists, is active and
 * is role "staff". Anything else fails safely to null (unassigned / Owner
 * pool), per D-034.
 */
export async function resolveReferralCode(
  code: string,
): Promise<ResolvedReferral | null> {
  if (!isValidReferralCode(code)) return null;
  try {
    const record = await prisma.referralCode.findUnique({
      where: { code },
      select: {
        userId: true,
        code: true,
        isActive: true,
        revokedAt: true,
        publicName: true,
        user: {
          select: { id: true, isActive: true, role: true, name: true },
        },
      },
    });
    if (!record) return null;
    if (!record.isActive || record.revokedAt) return null;
    if (!record.user.isActive || record.user.role !== "staff") return null;
    return {
      userId: record.userId,
      code: record.code,
      publicName: record.publicName,
      referrerName: record.user.name,
    };
  } catch {
    // Never let a public referral lookup break lead capture.
    return null;
  }
}

/**
 * Normalize a typed public referral name before any DB comparison.
 * Trims, collapses internal whitespace and enforces the max length, so input
 * such as "  Jane   Doe " matches the approved "Jane Doe" deterministically.
 * Returns null when the input is empty or exceeds the max length.
 */
export function normalizePublicName(raw: string): string | null {
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > MAX_PUBLIC_NAME_LENGTH) {
    return null;
  }
  return normalized;
}

/**
 * Equality key for approved public referral names (Task #029, Fix 2).
 * Storage and lookup MUST both go through this function so that "Jane  Doe",
 * " jane doe " and "JANE DOE" are treated as the same registered name.
 * The key is persisted in ReferralCode.publicNameNormal, which is UNIQUE —
 * the duplicate-name guard is therefore an atomic, race-safe constraint.
 */
export function publicNameKey(normalized: string): string {
  return normalized.toLowerCase();
}

/**
 * Manual fallback: resolve an approved publicName typed by the visitor
 * ("Who referred you?") to the single active Staff member with that
 * public name.
 *
 * AMBIGUITY RULE (Task #027/#029): the name must resolve to EXACTLY ONE
 * eligible Staff member. Zero matches fails safely to null (no such
 * referrer, including legacy rows quarantined as NULL keys by the backfill
 * migration); more than one match is REJECTED as ambiguous — a lead is never
 * assigned to one of several matching Staff members on the basis of database
 * ordering. Equivalence is enforced by publicNameKey; the race-safe unique
 * constraint guarantees at most one ACTIVE row can carry a given key, so
 * ambiguity cannot arise from equivalent registrations.
 */
export async function resolveReferralByName(
  publicName: string,
): Promise<ResolvedReferral | null> {
  const normalized = normalizePublicName(publicName);
  if (!normalized) return null;
  try {
    const records = await prisma.referralCode.findMany({
      where: {
        isActive: true,
        revokedAt: null,
        publicNameNormal: publicNameKey(normalized),
        user: { isActive: true, role: "staff" },
      },
      select: {
        userId: true,
        code: true,
        publicName: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (records.length !== 1) return null; // 0 = unknown; >1 = ambiguous
    const record = records[0]!;
    return {
      userId: record.userId,
      code: record.code,
      publicName: record.publicName,
      referrerName: record.user.name,
    };
  } catch {
    return null;
  }
}

/**
 * Duplicate-public-name guard for Owner management (Task #027/#029): an
 * ACTIVE, non-revoked referral code may not reuse another Staff member's
 * active public referral name. Revoked names do not block reuse (their
 * normalized key is NULL); quarantined legacy collisions are also inert.
 * This is primarily a friendly pre-check: the unique constraint on
 * ReferralCode.publicNameNormal enforces the rule race-safe under concurrent
 * Owner operations. Returns the clashing record, or null when the name is
 * free.
 */
export async function findActivePublicNameConflict(
  publicName: string,
  excludeUserId: string,
): Promise<{ userId: string } | null> {
  const normalized = normalizePublicName(publicName);
  if (!normalized) return null;
  try {
    return await prisma.referralCode.findFirst({
      where: {
        isActive: true,
        revokedAt: null,
        publicNameNormal: publicNameKey(normalized),
        userId: { not: excludeUserId },
      },
      select: { userId: true },
    });
  } catch {
    // Fail CLOSED: a transient DB error must not silently allow a name clash.
    throw new Error("referral_name_conflict_check_unavailable");
  }
}

/** Builds the public shareable link for a referral code (Owner/Staff views). */
export function buildReferralLink(code: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/business?ref=${encodeURIComponent(code)}`;
}
