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
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "staff",
        input: false,
      },
    },
  },
});
