"use client";

import Link from "next/link";
import { useState } from "react";
import { isValidOfficeEmail, normalizeOfficeEmail } from "@/lib/office-form-validation";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!isValidOfficeEmail(email)) {
      setError("Enter a valid work email address.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: normalizeOfficeEmail(email) }),
      });
      if (res.status === 503) {
        setError("Email recovery is currently unavailable. Please contact the office owner.");
      } else if (res.status === 429) {
        setError("Too many requests. Please try again later.");
      } else if (!res.ok) {
        setError("Could not submit your request. Please try again.");
      } else {
        setMessage("If this email belongs to an active office account, we'll send a password reset link. Check your inbox and spam folder.");
      }
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {message ? (
        <div role="status" className="office-auth-success">
          <p className="font-bold">Request received</p>
          <p className="mt-2">{message}</p>
          <button type="button" onClick={() => { setMessage(null); setEmail(""); }} className="mt-4 text-sm font-bold underline underline-offset-4">Send another request</button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6" noValidate aria-busy={loading}>
          <div>
            <label htmlFor="recovery-email" className="office-auth-label">Work email</label>
            <input id="recovery-email" type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254}
              placeholder="you@company.com" className="office-auth-input" required disabled={loading} value={email}
              onChange={(event) => { setEmail(event.target.value); setError(null); }} />
          </div>
          {error ? <p role="alert" className="office-auth-error">{error}</p> : null}
          <button className="office-auth-submit" type="submit" disabled={loading}>
            {loading ? <><span className="office-auth-spinner" aria-hidden="true"/> Sending request…</> : <>Email me a reset link <span aria-hidden="true">↗</span></>}
          </button>
        </form>
      )}
      <Link href="/admin/login" className="mt-7 inline-flex text-sm font-bold text-mulberry-700 underline-offset-4 hover:underline">← Back to sign in</Link>
    </div>
  );
}
