/**
 * Authoritative CRM authorization. Better Auth validates the cookie, then the
 * database supplies CURRENT role, activity, and password-change flags. This
 * rejects a previously issued session after an Owner deactivates the user.
 * Lazy imports keep Node-only auth code out of client action bundles.
 */
import { redirect } from "next/navigation";
import { isAllowedCrmAccount, type CrmRole } from "@/lib/crm-login-policy";

export type CrmUser = {
  id: string;
  email: string;
  name: string;
  role: CrmRole;
  mustChangePassword: boolean;
};

async function loadSession() {
  const { auth } = await import("@/lib/auth");
  const { headers: nextHeaders } = await import("next/headers");
  return auth.api.getSession({ headers: await nextHeaders() });
}

/** Return only an active Owner/Staff user whose DB account still exists. */
export async function getCrmUser(): Promise<CrmUser | null> {
  const session = await loadSession();
  if (!session?.user?.id) return null;

  const { prisma } = await import("@/server/db/prisma");
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });
  if (!isAllowedCrmAccount(account)) return null;

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    mustChangePassword: account.mustChangePassword,
  };
}

export async function requireCrmUser(): Promise<CrmUser> {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdmin(): Promise<CrmUser> {
  const user = await requireCrmUser();
  if (user.role !== "admin") redirect("/admin");
  return user;
}

export async function isAdminSession(): Promise<boolean> {
  return (await getCrmUser())?.role === "admin";
}
