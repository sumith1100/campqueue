"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/live";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await postJson("/api/auth/login", { pin: new FormData(e.currentTarget).get("pin") });
          router.replace(next);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not sign in");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-1.5">
        <span className="font-semibold">PIN</span>
        <input name="pin" type="password" inputMode="numeric" autoComplete="current-password" className="field text-2xl tracking-[0.4em]" required autoFocus />
      </label>
      <p aria-live="polite" className="min-h-6 font-semibold text-alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        Sign in
      </button>
    </form>
  );
}
