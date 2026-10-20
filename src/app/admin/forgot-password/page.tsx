import type { Metadata } from "next";
import { OfficeAuthShell } from "@/components/admin/OfficeAuthShell";
import { ForgotPasswordForm } from "@/components/admin/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recover Office Access — NEOLIFE",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <OfficeAuthShell eyebrow="Account recovery" title="Forgot your password?"
      description="Enter your work email address. If you have an active account, we'll send instructions for resetting your password.">
      <ForgotPasswordForm />
    </OfficeAuthShell>
  );
}
