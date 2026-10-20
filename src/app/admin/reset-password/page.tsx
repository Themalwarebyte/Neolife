import type { Metadata } from "next";
import { OfficeAuthShell } from "@/components/admin/OfficeAuthShell";
import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password — NEOLIFE Office",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <OfficeAuthShell eyebrow="Secure reset" title="Choose a new password."
      description="Use the one-time link from your email to restore access to your office account.">
      <ResetPasswordForm />
    </OfficeAuthShell>
  );
}
