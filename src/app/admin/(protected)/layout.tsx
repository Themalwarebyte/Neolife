import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/requireAdmin";
import { SignOutButton } from "@/components/admin/SignOutButton";

/**
 * Task 1.7 — protected CRM route group.
 * Server-side guard: unauthenticated or non-admin users are redirected.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <a
              href="/admin/leads"
              className="text-lg font-extrabold tracking-tight text-neutral-900"
            >
              NEOLIFE <span className="text-brand-600">CRM</span>
            </a>
            <span className="hidden text-xs uppercase tracking-widest text-neutral-400 sm:inline">
              Office
            </span>
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
