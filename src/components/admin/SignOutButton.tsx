"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100 disabled:opacity-60"
    >
      Sign out
    </button>
  );
}
