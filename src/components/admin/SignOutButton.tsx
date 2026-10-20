"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        setError("Sign out failed. Try again.");
        return;
      }
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={signOut} disabled={loading}
        className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60">
        {loading ? "Signing out…" : "Sign out ↗"}
      </button>
      {error ? <span role="alert" className="max-w-56 text-right text-xs text-rose-100">{error}</span> : null}
    </div>
  );
}
