import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { redirect } from "next/navigation";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * Phase A — protected CRM route group (two-user support).
 * Server-side guard: unauthenticated users are redirected to /admin/login.
 * Any authenticated CRM user (admin or staff) can access the route group.
 * Ownership scoping happens at the data layer (per-page query filters).
 *
 * Phase 5 — Mulberry admin shell: deep-plum top bar, mulberry sidebar
 * navigation with notification bell, animated shell background (static for
 * reduced-motion users), white content surfaces.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCrmUser();

  if (user.mustChangePassword) {
    redirect("/admin/change-password");
  }

  return (
    <div className="mulberry-shell min-h-screen">
      <header className="bg-mulberry-800 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <a
              href="/admin/leads"
              className="text-lg font-extrabold tracking-tight"
            >
              NEOLIFE <span className="text-mulberry-300">CRM</span>
            </a>
            <span className="hidden text-xs uppercase tracking-widest text-mulberry-300/80 sm:inline">
              Office
            </span>
            {user.role === "admin" ? (
              <span className="rounded-full bg-mulberry-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                Owner
              </span>
            ) : (
              <span className="rounded-full bg-mulberry-500/40 px-2.5 py-0.5 text-xs font-semibold text-white">
                Colleague
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="hidden text-sm text-mulberry-100/80 sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-0 px-0 sm:flex-row sm:px-8">
        <AdminNav role={user.role} />

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
