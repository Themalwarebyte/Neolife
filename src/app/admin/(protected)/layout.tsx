import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { redirect } from "next/navigation";

/**
 * Phase A — protected CRM route group (two-user support).
 * Server-side guard: unauthenticated users are redirected to /admin/login.
 * Any authenticated CRM user (admin or staff) can access the route group.
 * Ownership scoping happens at the data layer (per-page query filters).
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
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <a
              href="/admin/leads"
              className="text-lg font-extrabold tracking-tight text-neutral-900"
            >
              NEOLIFE <span className="text-brand-600">CRM</span>
            </a>
            <span className="hidden text-xs uppercase tracking-widest text-neutral-400 sm:inline">
              Office
            </span>
            {user.role === "admin" ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Owner
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                Colleague
              </span>
            )}
            {user.role === "admin" ? (
              <a
                href="/admin/users"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Users
              </a>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
