"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/live";

type User = { id: string; name: string; designation: string; role: "staff" | "volunteer" };

export function LoginForm({ next, users }: { next: string; users: User[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try {
        const data = new FormData(e.currentTarget);
        await postJson("/api/auth/login", { userId: data.get("userId"), pin: data.get("pin") });
        router.replace(next); router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not sign in");
      } finally { setBusy(false); }
    }}>
      <label className="grid gap-1.5">
        <span className="font-semibold">Name</span>
        <select name="userId" className="field" required autoFocus defaultValue="">
          <option value="" disabled>Select your name</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.designation}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="font-semibold">Personal PIN</span>
        <input name="pin" type="password" inputMode="numeric" autoComplete="current-password" className="field text-2xl tracking-[0.4em]" required minLength={4} maxLength={6} />
      </label>
      <p aria-live="polite" className="min-h-6 font-semibold text-alert">{error}</p>
      <button className="btn btn-primary" disabled={busy}>Sign in</button>
    </form>
  );
}
