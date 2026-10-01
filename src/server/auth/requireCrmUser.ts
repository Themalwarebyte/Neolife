/**
 * Role-aware CRM authorization (Phase A: Two-user support).
 *
 * Extends the original admin-only guard to support two roles:
 * - "admin" (Owner): full access to all CRM data, user/role management
 * - "staff" (Colleague): CRM access scoped to assigned leads only
 *
 * Better Auth is loaded lazily (dynamic import) so its Node-only dependencies
 * stay out of the static import graph of Server Actions referenced by client
 * components. This avoids Turbopack's "external modules" bundling error.
 */
import { redirect } from "next/navigation";

type CrmUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
};

async function loadSession() {
  const { auth } = await import("@/lib/auth");
  const { headers: nextHeaders } = await import("next/headers");
  return auth.api.getSession({ headers: await nextHeaders() });
}

/** Returns the authenticated CRM user (any role), or null if unauthenticated/inactive. */
export async function getCrmUser(): Promise<CrmUser | null> {
  const session = await loadSession();
  const user = session?.user;
  if (!user) return null;
  if (!user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

/** Returns the authenticated CRM user, redirecting to login if unauthenticated. */
export async function requireCrmUser(): Promise<CrmUser> {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Returns the authenticated admin user, redirecting if unauthenticated or non-admin. */
export async function requireAdmin(): Promise<CrmUser> {
  const user = await requireCrmUser();
  if (user.role !== "admin") {
    redirect("/admin");
  }
  return user;
}

/** Returns true if the current session is an admin. */
export async function isAdminSession(): Promise<boolean> {
  const user = await getCrmUser();
  return user !== null && user.role === "admin";
}
