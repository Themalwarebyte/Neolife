import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { OfficeAuthShell } from "@/components/admin/OfficeAuthShell";
import { getCrmUser } from "@/server/auth/requireCrmUser";
import { getCrmLoginDestination } from "@/lib/crm-login-policy";

export const metadata: Metadata = {
  title: "Office Sign In — NEOLIFE",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getCrmUser();
  if (user) {
    const destination = getCrmLoginDestination({
      isActive: true,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
    if (destination) redirect(destination);
  }
  return (
    <OfficeAuthShell
      eyebrow="Welcome back"
      title="Sign in to your office."
      description="Access your workspace with your authorized NEOLIFE account."
    >
      <LoginForm />
    </OfficeAuthShell>
  );
}
