"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isValidOfficePassword, officePasswordMismatch } from "@/lib/office-form-validation";

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const resetToken = url.searchParams.get("token");
    const resetError = url.searchParams.get("error");
    if (resetToken && resetToken.length <= 4096 && !resetError) {
      setToken(resetToken);
    } else {
      setError("This link is invalid or expired. Request a new one.");
    }
    // Drop the sensitive token from the address bar/history immediately.
    window.history.replaceState(window.history.state, "", "/admin/reset-password");
    setReady(true);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !token) return;
    if (!isValidOfficePassword(password)) {
      setError("Choose a password between 8 and 128 characters.");
      return;
    }
    if (officePasswordMismatch(password, confirmation)) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Too many attempts. Please try again later." : "The reset link is invalid or expired. Request a new one.");
        return;
      }
      setToken(null);
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <p role="status" className="text-sm text-neutral-500">Checking reset link…</p>;
  if (complete) return (
    <div className="office-auth-success" role="status">
      <p className="font-bold">Password updated</p>
      <p className="mt-2">Sign in with your new password. Existing sessions have been revoked.</p>
      <Link href="/admin/login" className="mt-5 inline-flex font-bold underline underline-offset-4">Go to sign in →</Link>
    </div>
  );
  if (!token) return (
    <div>
      <p className="office-auth-error" role="alert">{error ?? "A valid reset link is required."}</p>
      <Link href="/admin/forgot-password" className="office-auth-submit mt-6">Request a new link →</Link>
    </div>
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-busy={loading}>
      <div>
        <label htmlFor="reset-password" className="office-auth-label">New password</label>
        <div className="relative mt-2">
          <input id="reset-password" type={showPassword ? "text" : "password"} autoComplete="new-password" className="office-auth-input pr-20"
            required minLength={8} maxLength={128} value={password} disabled={loading} onChange={(event) => { setPassword(event.target.value); setError(null); }} />
          <button type="button" className="office-auth-toggle" aria-label={showPassword ? "Hide passwords" : "Show passwords"}
            aria-pressed={showPassword} onClick={() => setShowPassword((prev) => !prev)} disabled={loading}>{showPassword ? "Hide" : "Show"}</button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Use at least 8 characters. Longer, unique passwords are recommended.</p>
      </div>
      <div>
        <label htmlFor="reset-confirm" className="office-auth-label">Confirm new password</label>
        <input id="reset-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128}
          className="office-auth-input" value={confirmation} disabled={loading} onChange={(event) => { setConfirmation(event.target.value); setError(null); }} />
      </div>
      {error ? <p role="alert" className="office-auth-error">{error}</p> : null}
      <button type="submit" className="office-auth-submit" disabled={loading}>
        {loading ? <><span className="office-auth-spinner" aria-hidden="true"/> Resetting…</> : <>Save new password <span aria-hidden="true">↗</span></>}
      </button>
      <Link href="/admin/forgot-password" className="block text-center text-sm font-bold text-mulberry-700 underline-offset-4 hover:underline">Request another link</Link>
    </form>
  );
}
