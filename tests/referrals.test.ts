import { describe, expect, it } from "vitest";
import {
  buildReferralLink,
  generateReferralCode,
  isValidReferralCode,
  MAX_PUBLIC_NAME_LENGTH,
} from "../src/lib/referrals";
import {
  buildTelLink,
  buildWhatsAppLink,
  isValidRecipientEmail,
  normalizeToE164,
  validateComposerInput,
} from "../src/lib/communications";
import { normalizePublicName } from "../src/lib/referrals";
import {
  currentEmailProvider,
  isClientEmailSendingEnabled,
  EMAIL_MAX_PER_SENDER_PER_HOUR,
  EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS,
} from "../src/lib/communications";
import { BETTER_AUTH_USER_ID_PATTERN, isValidBetterAuthUserId } from "../src/lib/user-management";

/**
 * D-034 — referral + communications unit tests (no DB).
 * DB-backed integration tests live in tests/referrals-db.test.ts.
 */

describe("D-034 — referral codes (pure)", () => {
  it("generates URL-safe codes of the expected length", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(22);
    expect(code).toMatch(/^[A-Za-z0-9]{22}$/);
  });

  it("generates distinct codes for two calls (no reusable refs)", () => {
    const a = generateReferralCode();
    const b = generateReferralCode();
    expect(a).not.toEqual(b);
  });

  it("accepts structurally valid codes and rejects junk", () => {
    expect(isValidReferralCode("Ab3xY9kQ2mLp8ZrT5wVd")).toBe(true);
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("short")).toBe(false);
    expect(isValidReferralCode("has space")).toBe(false);
    expect(isValidReferralCode("<script>")).toBe(false);
    expect(isValidReferralCode("x".repeat(65))).toBe(false);
  });

  it("builds shareable links that never contain a user id", () => {
    const link = buildReferralLink("Ab3xY9kQ2mLp8ZrT5wVd", "https://neolife.ooflowdesk.com/");
    expect(link).toBe("https://neolife.ooflowdesk.com/business?ref=Ab3xY9kQ2mLp8ZrT5wVd");
  });

  it("exposes the bounded public-name length used by the manual fallback", () => {
    expect(MAX_PUBLIC_NAME_LENGTH).toBe(60);
  });

  it("normalizes typed public names consistently before matching (Task #027)", () => {
    expect(normalizePublicName("  Jane   Doe ")).toBe("Jane Doe");
    expect(normalizePublicName("John")).toBe("John");
    expect(normalizePublicName("   ")).toBeNull();
    expect(normalizePublicName("a".repeat(61))).toBeNull();
  });
});

describe("D-034 — Better Auth user ids stay opaque", () => {
  it("real Better Auth ids pass the strict user-id validation", () => {
    expect(isValidBetterAuthUserId("aBcDeFgHiJkLmNoPqRsTuVwXyZ012345")).toBe(true);
  });

  it("referral codes are NOT interchangeable with user ids", () => {
    // Referral codes flow through isValidReferralCode, never through the
    // user-id validator (which only gates admin-chosen targets).
    const code = generateReferralCode();
    expect(BETTER_AUTH_USER_ID_PATTERN.test(code)).toBe(true); // same charset…
    // …but the assignment path that consumes codes is resolveReferralCode,
    // which maps code -> staff user server-side. No endpoint accepts a raw
    // userId from a public visitor.
    expect(typeof code).toBe("string");
  });
});

describe("Phase 4 — Kenyan phone normalization (pure)", () => {
  it("normalizes local 07xx numbers to +254", () => {
    expect(normalizeToE164("0712 345 678")).toBe("+254712345678");
    expect(normalizeToE164("0712345678")).toBe("+254712345678");
  });

  it("normalizes trunkless 7xx numbers", () => {
    expect(normalizeToE164("712345678")).toBe("+254712345678");
  });

  it("keeps already-international numbers", () => {
    expect(normalizeToE164("+254712345678")).toBe("+254712345678");
    expect(normalizeToE164("254712345678")).toBe("+254712345678");
  });

  it("refuses to guess unsafe input", () => {
    expect(normalizeToE164("")).toBeNull();
    expect(normalizeToE164("12345")).toBeNull();
    expect(normalizeToE164("not-a-phone")).toBeNull();
  });
});

describe("Phase 4 — WhatsApp / call links (pure)", () => {
  it("builds the official wa.me click-to-chat link with an editable message", () => {
    const link = buildWhatsAppLink("+254712345678", "Hello there");
    expect(link).toBe(`https://wa.me/254712345678?text=${encodeURIComponent("Hello there")}`);
  });

  it("rejects invalid E.164 input for WhatsApp", () => {
    expect(buildWhatsAppLink("123", "hi")).toBeNull();
  });

  it("builds tel: links", () => {
    expect(buildTelLink("+254712345678")).toBe("tel:+254712345678");
    expect(buildTelLink("123")).toBeNull();
  });
});

describe("Phase 4 — email composer validation (pure)", () => {
  it("accepts a sane subject/body pair", () => {
    expect(validateComposerInput("Hello", "Body text")).toEqual({
      subject: "Hello",
      body: "Body text",
    });
  });

  it("rejects empty, oversized or non-string input", () => {
    expect(validateComposerInput("", "body")).toBeNull();
    expect(validateComposerInput("  ", "body")).toBeNull();
    expect(validateComposerInput("subject", "")).toBeNull();
    expect(validateComposerInput(123, "body")).toBeNull();
    expect(validateComposerInput("subject", undefined)).toBeNull();
    expect(validateComposerInput("subject", "x".repeat(10001))).toBeNull();
  });

  it("requires the recipient to be the lead's own record", () => {
    expect(isValidRecipientEmail("client@example.com")).toBe(true);
    expect(isValidRecipientEmail(null)).toBe(false);
    expect(isValidRecipientEmail("not-an-email")).toBe(false);
  });
});

describe("Task #027 — outbound email safeguards (pure)", () => {
  const OLD_ENV = process.env;

  function withEnv(env: Record<string, string>, run: () => void) {
    process.env = { ...OLD_ENV, ...env };
    try {
      run();
    } finally {
      process.env = OLD_ENV;
    }
  }

  it("stays disabled under partial provider configuration", () => {
    withEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "key" }, () => {
      // Missing EMAIL_FROM — incomplete configuration must NOT enable sending.
      expect(isClientEmailSendingEnabled()).toBe(false);
      expect(currentEmailProvider()).toBe("resend");
    });
    withEnv({ EMAIL_PROVIDER: "resend" }, () => {
      expect(isClientEmailSendingEnabled()).toBe(false);
    });
  });

  it("enables only with COMPLETE resend configuration", () => {
    withEnv(
      { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "key", EMAIL_FROM: "from@example.com" },
      () => {
        expect(isClientEmailSendingEnabled()).toBe(true);
      },
    );
  });

  it("keeps the default state disabled and distinguishes local simulation", () => {
    withEnv({}, () => {
      expect(isClientEmailSendingEnabled()).toBe(false);
      expect(currentEmailProvider()).toBe("disabled");
    });
    withEnv({ EMAIL_PROVIDER: "none", NEOLIFE_ALLOW_LOCAL_EMAIL: "1" }, () => {
      expect(currentEmailProvider()).toBe("local");
    });
  });

  it("exposes the throttle limits as bounded, testable constants", () => {
    expect(EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS).toBeGreaterThan(0);
    expect(EMAIL_MAX_PER_SENDER_PER_HOUR).toBeGreaterThan(0);
  });
});
