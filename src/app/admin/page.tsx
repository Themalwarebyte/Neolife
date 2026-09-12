import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/requireAdmin";

export const dynamic = "force-dynamic";

/**
 * Admin Portal entry point (Owner-approved).
 * Server-side redirect:
 *   - unauthenticated (or non-admin) → /admin/login
 *   - authenticated admin           → /admin/leads
 */
export default async function AdminIndexPage() {
  const user = await getAdminUser();
  if (user) redirect("/admin/leads");
  redirect("/admin/login");
}
