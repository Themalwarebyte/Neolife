"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidOfficeEmail, normalizeOfficeEmail } from "@/lib/office-form-validation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const fields = new FormData(event.currentTarget);
    const email = normalizeOfficeEmail(String(fields.get("email") ?? ""));
    const password = String(fields.get("password") ?? "");
    if (!isValidOfficeEmail(email) || password.length === 0) {
      setError("Enter a valid email address and your password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password }),
        cache: "no-store",
      });
      if (!response.ok) {
        setError(response.status === 429
          ? "Too many sign-in attempts. Please try again shortly."
          : "Unable to sign in. Check your credentials or contact the office owner.");
        return;
      }
      // Never infer CRM authorization just from a valid Better Auth cookie.
      // The server checks CURRENT account role, activation and password policy.
      const state = await fetch("/api/admin/login-state", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!state.ok) {
        await fetch("/api/auth/sign-out", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }).catch(() => undefined);
        setError("This account cannot access the office. Contact the office owner.");
        return;
      }
      const body: unknown = await state.json();
      const destination = body && typeof body === "object" && "destination" in body
        ? (body as { destination: unknown }).destination
        : null;
      if (destination !== "/admin/leads" && destination !== "/admin/change-password") {
        setError("Could not confirm office access. Please try again.");
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Could not connect securely. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-busy={loading}>
      <div>
        <label htmlFor="office-email" className="office-auth-label">Work email</label>
        <input id="office-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={loading}
          className="office-auth-input" placeholder="you@company.com" aria-invalid={Boolean(error)} onChange={() => { if (error) setError(null); }} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="office-password" className="office-auth-label">Password</label>
          <Link href="/admin/forgot-password" className="text-sm font-bold text-mulberry-700 underline-offset-4 transition hover:text-mulberry-900 hover:underline">Forgot password?</Link>
        </div>
        <div className="relative mt-2">
          <input id="office-password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" disabled={loading}
            className="office-auth-input pr-20" placeholder="Enter your password" aria-invalid={Boolean(error)}
            onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
            onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
            onChange={() => { if (error) setError(null); }} />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
            onClick={() => setShowPassword((prev) => !prev)} className="office-auth-toggle" disabled={loading}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {capsLock ? <p className="mt-2 text-xs font-semibold text-amber-800" role="status">Caps Lock is on</p> : null}
      </div>
      {error ? <p role="alert" className="office-auth-error">{error}</p> : null}
      <button type="submit" disabled={loading} className="office-auth-submit">
        {loading ? <><span className="office-auth-spinner" aria-hidden="true" /> Verifying account…</> : <>Sign in <span aria-hidden="true">↗</span></>}
      </button>
      <p className="text-center text-xs leading-6 text-neutral-500">Access is limited to authorized NEOLIFE team members. Your session is protected.</p>
    </form>
  );
}
