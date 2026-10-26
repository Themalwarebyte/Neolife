import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/server/db/prisma";
import { isEmailConfigured, sendMail } from "@/lib/email";
import { buildOfficeResetEmail } from "@/lib/auth-recovery-email";
import { recordActivityAudit } from "@/lib/activity-audit";

/**
 * Task 1.7 — Better Auth (Owner-approved architecture, docs/PROJECT_PLAN.md §15).
 * - Password storage is handled by Better Auth (hashed), never by this app.
 * - Session cookies are issued/verified by Better Auth.
 * - `role` is the office/admin boundary; "admin" can access the CRM.
 * - `input: false` means clients cannot self-assign the role (no public signup).
 */

/**
 * Better Auth rate limiting is enabled by default in production and throttles
 * sign-in routes to 3 requests per 10 seconds per IP. The Playwright E2E suite
 * legitimately performs five sign-ins from one IP within seconds (global setup
 * + the P-2 user-management workflow), which trips that default and makes the
 * suite fail spuriously. E2E runs opt out explicitly via the webServer env
 * (E2E_DISABLE_AUTH_RATE_LIMIT=1); production keeps the default limiter.
 */
const isE2ERun = process.env.E2E_DISABLE_AUTH_RATE_LIMIT === "1";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Better Auth signs and checks one-time reset tokens. Revoke existing
    // sessions when credentials are reset; existing password hashes untouched.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Never claim email was delivered in a test or without live Resend.
      if (process.env.EMAIL_PROVIDER?.toLowerCase() !== "resend" || !isEmailConfigured()) return;
      const account = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true, role: true },
      });
      if (!account?.isActive || !["admin", "staff"].includes(account.role)) return;
      let message: ReturnType<typeof buildOfficeResetEmail>;
      try {
        // A reverse-proxy Host header must never redirect credential links
        // to a different origin than the configured Better Auth service.
        const configured = process.env.BETTER_AUTH_URL;
        if (configured && new URL(configured).origin !== new URL(url).origin) {
          throw new Error("Untrusted password recovery origin");
        }
        message = buildOfficeResetEmail(url);
      } catch {
        // Do not send suspicious recovery links.
        console.warn("[auth] Invalid reset URL; email suppressed.");
        return;
      }
      // Avoid making account existence measurable through email latency.
      void sendMail({ to: user.email, ...message }).then((outcome) => {
        if (!outcome.ok) console.warn("[auth] Password reset email delivery failed.");
      }).catch(() => {
        console.warn("[auth] Password reset email delivery failed.");
      });
    },
    onPasswordReset: async ({ user }) => {
      // A successful reset meets the initial password-change requirement.
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { mustChangePassword: false },
        });
      } catch {
        // Never report a completed credential reset as failed because of
        // a secondary profile update. Existing CRM guard remains fail-safe.
        console.warn("[auth] Password reset completed; profile sync failed.");
      }
      await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.id, action: "PASSWORD_RESET_COMPLETED", entityType: "USER", entityId: user.id, outcome: "SUCCESS" });
    },
  },
  ...(isE2ERun ? { rateLimit: { enabled: false } } : {}),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "staff",
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        defaultValue: false,
        input: true,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
});
