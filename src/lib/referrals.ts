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
 * Manual fallback: resolve an approved publicName typed by the visitor
 * ("Who referred you?") to the single active Staff member with that
 * public name. Returns null when there is no match — it is NOT an error to
 * type a name that does not exist (fail-safe to Owner pool).
 */
export async function resolveReferralByName(
  publicName: string,
): Promise<ResolvedReferral | null> {
  const trimmed = publicName.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PUBLIC_NAME_LENGTH) {
    return null;
  }
  try {
    const record = await prisma.referralCode.findFirst({
      where: {
        isActive: true,
        revokedAt: null,
        publicName: { equals: trimmed },
        user: { isActive: true, role: "staff" },
      },
      select: {
        userId: true,
        code: true,
        publicName: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!record) return null;
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

/** Builds the public shareable link for a referral code (Owner/Staff views). */
export function buildReferralLink(code: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/business?ref=${encodeURIComponent(code)}`;
}
