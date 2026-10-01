import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/server/db/prisma";

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
