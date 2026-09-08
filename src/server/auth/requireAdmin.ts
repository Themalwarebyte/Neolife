/**
 * Task 1.7 — server-side authorization guard.
 *
 * Better Auth is loaded lazily (dynamic import) so its Node-only dependencies
 * (e.g. `node:module`) stay out of the static import graph of Server Actions
 * that are referenced by client components. This avoids Turbopack's
 * "external modules" bundling error while keeping full session verification.
 */
async function loadSession() {
  const { auth } = await import("@/lib/auth");
  const { headers: nextHeaders } = await import("next/headers");
  return auth.api.getSession({ headers: await nextHeaders() });
}

export async function getAdminUser() {
  const session = await loadSession();
  const user = session?.user;
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function isAdmin() {
  return (await getAdminUser()) !== null;
}
