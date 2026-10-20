"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, type CrmActionResult } from "@/app/admin/(protected)/actions";
import { isValidOfficePassword, officePasswordMismatch } from "@/lib/office-form-validation";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<CrmActionResult | null, FormData>(changePasswordAction, null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [currentPresent, setCurrentPresent] = useState(false);

  useEffect(() => {
    if (state?.status === "success") {
      router.replace("/admin/leads");
      router.refresh();
    }
  }, [state, router]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    setLocalError(null);
    if (!currentPresent) {
      event.preventDefault();
      setLocalError("Enter your current password.");
    } else if (!isValidOfficePassword(newPassword)) {
      event.preventDefault();
      setLocalError("Your new password must have 8 to 128 characters.");
    } else if (officePasswordMismatch(newPassword, confirmPassword)) {
      event.preventDefault();
      setLocalError("Your new passwords do not match.");
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" aria-busy={isPending} noValidate>
      <div>
        <label htmlFor="currentPassword" className="office-auth-label">Current password</label>
        <input id="currentPassword" name="currentPassword" type={showPasswords ? "text" : "password"} required autoComplete="current-password"
          className="office-auth-input" disabled={isPending} onChange={(event) => { setCurrentPresent(Boolean(event.target.value)); setLocalError(null); }}/>
      </div>
      <div>
        <label htmlFor="newPassword" className="office-auth-label">New password</label>
        <input id="newPassword" name="newPassword" type={showPasswords ? "text" : "password"} required autoComplete="new-password"
          minLength={8} maxLength={128} className="office-auth-input" disabled={isPending} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setLocalError(null); }}/>
        <p className="mt-2 text-xs text-neutral-500">Choose a unique password of at least eight characters.</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="office-auth-label">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type={showPasswords ? "text" : "password"} required autoComplete="new-password"
          minLength={8} maxLength={128} className="office-auth-input" disabled={isPending} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setLocalError(null); }}/>
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-mulberry-800">
        <input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} className="h-4 w-4 accent-mulberry-700" disabled={isPending}/>
        Show passwords
      </label>
      {localError || state?.status === "error" ? <p role="alert" className="office-auth-error">{localError ?? state?.message}</p> : null}
      {state?.status === "success" ? <p role="status" className="office-auth-success">Password updated. Taking you to your workspace…</p> : null}
      <button type="submit" disabled={isPending} className="office-auth-submit">
        {isPending ? <><span className="office-auth-spinner" aria-hidden="true"/> Saving…</> : <>Save new password <span aria-hidden="true">↗</span></>}
      </button>
    </form>
  );
}
