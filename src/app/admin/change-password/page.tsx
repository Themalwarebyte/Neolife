import type { Metadata } from "next";
import { getCrmUser } from "@/server/auth/requireCrmUser";
import { redirect } from "next/navigation";
import { OfficeAuthShell } from "@/components/admin/OfficeAuthShell";
import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Change Password — NEOLIFE Office", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login");
  if (!user.mustChangePassword) redirect("/admin/leads");
  return (
    <OfficeAuthShell eyebrow="Account protection" title="Secure your account."
      description="Your office account requires a new password before you can continue to the CRM.">
      <ChangePasswordForm />
    </OfficeAuthShell>
  );
}
