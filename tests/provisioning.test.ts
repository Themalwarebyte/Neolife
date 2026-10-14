import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  validateProvisioningIntent,
  isValidProvisioningEmail,
  type ProvisioningIntent,
} from "../src/lib/provisioning";
import {
  OPERATIONAL_EMAIL_ENABLED_ENV,
  buildNewLeadAlertEmail,
  crmBaseUrl,
  isOperationalEmailSendingEnabled,
  notificationRecipientEmail,
  ownerQueueRecipientEmails,
} from "../src/lib/notificationsEmail";

/**
 * Task #037 — provisioning + operational-notification UNIT tests (no DB).
 * DB-backed provisioning integration tests live in tests/provisioning-db.test.ts.
 */

const baseIntent: ProvisioningIntent = {
  kind: "owner",
  name: "Glen Fixture",
  email: "provisioner-owner@test.local",
  phone: "07189990000",
};

describe("Task #037 — temporary password generation (CSPRNG, requirement 6)", () => {
  it("generates a long URL-safe password with high entropy", () => {
    const password = generateTemporaryPassword();
    expect(password.length).toBeGreaterThanOrEqual(20);
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/); // URL/base64url-safe
  });

  it("generates unique passwords per account (never reusable, never hardcoded)", () => {
    const drawn = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
    expect(drawn.size).toBe(50);
    // No call site list of "default passwords" exists — the value comes from
    // CSPRNG randomBytes on every call.
    expect(drawn.has("admin-password-12345")).toBe(false);
  });
});

describe("Task #037 — provisioning validation", () => {
  it("accepts a fully-formed intent", () => {
    expect(validateProvisioningIntent(baseIntent)).toBeNull();
  });

  it("rejects missing/oversized names", () => {
    expect(validateProvisioningIntent({ ...baseIntent, name: "" })).toMatch(/Name/);
    expect(validateProvisioningIntent({ ...baseIntent, name: "x".repeat(81) })).toMatch(/Name/);
  });

  it("rejects structurally invalid emails", () => {
    expect(validateProvisioningIntent({ ...baseIntent, email: "not-an-email" })).toMatch(/Invalid email/);
    expect(isValidProvisioningEmail("@neolife.local")).toBe(false);
  });

  it("rejects oversized phone numbers", () => {
    expect(
      validateProvisioningIntent({ ...baseIntent, phone: "0".repeat(25) }),
    ).toMatch(/Phone/);
  });

  it("rejects an invalid notification-email preference", () => {
    expect(
      validateProvisioningIntent({ ...baseIntent, notificationEmail: "broken@" }),
    ).toMatch(/notification email/i);
  });
});

describe("Task #037 — notification recipient preference", () => {
  it("uses the explicit notificationEmail when set (whitespace-tolerant)", () => {
    expect(
      notificationRecipientEmail({ email: "a@test.local", notificationEmail: " b@test.local " }),
    ).toBe("b@test.local");
  });

  it("falls back to the login email when the preference is null/blank", () => {
    expect(notificationRecipientEmail({ email: "a@test.local", notificationEmail: null })).toBe(
      "a@test.local",
    );
    expect(notificationRecipientEmail({ email: "a@test.local", notificationEmail: "" })).toBe(
      "a@test.local",
    );
  });
});

describe("Task #037 — Owner-queue alert recipients (requirement 11)", () => {
  const admins = [
    { role: "admin", isActive: true, email: "owner1@test.local", notificationEmail: "owner1-notifs@test.local" },
    { role: "admin", isActive: false, email: "inactive@test.local", notificationEmail: null },
    { role: "staff", isActive: true, email: "partner@test.local", notificationEmail: "partner-notifs@test.local" },
    { role: "admin", isActive: true, email: "dup@test.local", notificationEmail: "dup@test.local" },
    { role: "admin", isActive: true, email: "dup-second@test.local", notificationEmail: "dup@test.local" },
  ];

  it("alerts ONLY active admins — never staff — and dedupes addresses", () => {
    const recipients = ownerQueueRecipientEmails(admins);
    expect(recipients).toContain("owner1-notifs@test.local");
    expect(recipients).toContain("dup@test.local");
    // inactive admin excluded; staff EXCLUDED entirely (D-027 privacy)
    expect(recipients).not.toContain("inactive@test.local");
    expect(recipients).not.toContain("partner@test.local");
    expect(recipients).not.toContain("partner-notifs@test.local");
    expect(recipients.filter((r) => r === "dup@test.local")).toHaveLength(1);
  });
});

describe("Task #037 — privacy-conscious alert email content (requirement 12)", () => {
  const leadId = "11111111-2222-3333-4444-555555555555";

  it("assignment alert carries the CRM link and NO client PII", () => {
    const email = buildNewLeadAlertEmail(
      { kind: "assigned_to_you", baseUrl: "https://neolife.ooflowdesk.com", leadId },
      "Glen",
    );
    expect(email?.subject).toContain("assigned to you");
    expect(email?.html).toContain("/admin/leads/11111111-2222-3333-4444-555555555555");
    expect(email?.text).toContain("(sign-in required)");
    // The alert body NEVER includes client name/phone/email fields.
    expect(email?.text).not.toContain("Phone");
    expect(email?.text).not.toContain("First name");
  });

  it("queue alert is addressed as an Owner-queue event", () => {
    const email = buildNewLeadAlertEmail(
      { kind: "owner_queue", baseUrl: "https://neolife.ooflowdesk.com/", leadId },
      "Rahab",
    );
    expect(email?.subject).toContain("unassigned queue");
  });

  it("returns null for a structurally invalid lead id (never throws)", () => {
    expect(
      buildNewLeadAlertEmail({ kind: "assigned_to_you", baseUrl: "https://x.test", leadId: "evil" }, "A"),
    ).toBeNull();
    expect(
      buildNewLeadAlertEmail({ kind: "assigned_to_you", baseUrl: "https://x.test", leadId: "<script>alert(1)</script>" }, "A"),
    ).toBeNull();
  });

  it("renders a hostile recipient name inertly (no markup survives)", () => {
    const email = buildNewLeadAlertEmail(
      { kind: "assigned_to_you", baseUrl: "https://x.test", leadId },
      'Eve <img src=x onerror="alert(1)">',
    );
    // The markup-bearing characters are stripped, so the sanitized name
    // renders as inert plain text — it can never become an element or
    // attribute inside the email HTML.
    const sanitized = '<img src=x onerror="alert(1)"'.replace(/[<>&"']/g, "");
    expect(email?.text).toContain(`Hi Eve ${sanitized},`);
    expect(email?.html).toContain(`Hi Eve ${sanitized},<`);
    expect(email?.html).not.toContain("<img");
  });
});

describe("Task #037 — external email stays disabled without explicit approval (requirement 15)", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM", OPERATIONAL_EMAIL_ENABLED_ENV]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("disabled by default — nothing is attempted with no configuration", () => {
    expect(isOperationalEmailSendingEnabled()).toBe(false);
  });

  it("disabled when the provider is not resend (fail-safe)", () => {
    process.env.EMAIL_PROVIDER = "none";
    process.env.RESEND_API_KEY = "re_key_placeholder";
    process.env.EMAIL_FROM = "GHub Technologies-Neolife <noreply@mail.ooflowdesk.com>";
    process.env[OPERATIONAL_EMAIL_ENABLED_ENV] = "1";
    expect(isOperationalEmailSendingEnabled()).toBe(false);
  });

  it("disabled on partial configuration (no API key, no From, or no flag)", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_key_placeholder";
    expect(isOperationalEmailSendingEnabled()).toBe(false);

    process.env.EMAIL_FROM = "GHub Technologies-Neolife <noreply@mail.ooflowdesk.com>";
    // Fully configured but the explicit Owner-approval flag is absent:
    expect(isOperationalEmailSendingEnabled()).toBe(false);
  });

  it("enabled ONLY with full configuration AND the explicit flag", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_key_placeholder";
    process.env.EMAIL_FROM = "GHub Technologies-Neolife <noreply@mail.ooflowdesk.com>";
    process.env[OPERATIONAL_EMAIL_ENABLED_ENV] = "1";
    expect(isOperationalEmailSendingEnabled()).toBe(true);
  });
});

describe("Task #037 — CRM base URL resolution", () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  const savedAuth = process.env.BETTER_AUTH_URL;

  afterAll(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
    if (savedAuth === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = savedAuth;
  });

  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://neolife.ooflowdesk.com/";
    delete process.env.BETTER_AUTH_URL;
    expect(crmBaseUrl()).toBe("https://neolife.ooflowdesk.com");
  });
});
