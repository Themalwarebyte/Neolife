import { redirect } from "next/navigation";
import { getCrmUser } from "@/server/auth/requireCrmUser";

export const dynamic = "force-dynamic";

/**
 * Admin Portal entry point (Phase A: two-user support).
 * Server-side redirect:
 *   - unauthenticated      → /admin/login
 *   - authenticated (any)  → /admin/leads
 */
export default async function AdminIndexPage() {
  const user = await getCrmUser();
  if (user) redirect("/admin/leads");
  redirect("/admin/login");
}
