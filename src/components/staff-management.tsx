"use client";

import { useState, type FormEvent } from "react";
import { postJson } from "@/components/live";

type User = {
  id: string;
  name: string;
  designation: string;
  role: "staff" | "volunteer";
  active: boolean;
  createdAt: number;
};

export function StaffManagement({ initial }: { initial: User[] }) {
  const [users, setUsers] = useState(initial);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [role, setRole] = useState<"staff" | "volunteer">("volunteer");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load staff");
    const data = (await res.json()) as { users: User[] };
    setUsers(data.users);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/admin/users", { name, designation, role, pin });
      setName("");
      setDesignation("");
      setPin("");
      setMessage("Staff account created. Share the PIN securely with that person.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(user: User) {
    setBusy(true);
    setMessage(null);
    try {
      await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error ?? "Could not update account");
        }
      });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <form className="grid gap-4 rounded-2xl border border-line bg-white p-5" onSubmit={create}>
        <div>
          <h2 className="text-2xl font-bold">Add staff or volunteer</h2>
          <p className="mt-1 text-ink-soft">Each person gets their own PIN. PINs are stored as secure hashes and are never shown back.</p>
        </div>
        <label className="grid gap-1.5">
          <span className="font-semibold">Full name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Designation</span>
          <input className="field" placeholder="Camp Volunteer / Nurse / Coordinator" value={designation} onChange={(e) => setDesignation(e.target.value)} required maxLength={80} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Role</span>
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as "staff" | "volunteer")}>
            <option value="volunteer">Volunteer</option>
            <option value="staff">Staff</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">PIN</span>
          <input className="field text-xl tracking-[0.3em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="new-password" minLength={4} maxLength={6} required />
        </label>
        <button className="btn btn-primary" disabled={busy}>Create account</button>
        <p aria-live="polite" className="min-h-6 font-semibold text-alert">{message}</p>
      </form>

      <section className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold">Staff & volunteers</h2>
          <p className="text-ink-soft">{users.length} account{users.length === 1 ? "" : "s"} registered</p>
        </div>
        {users.length === 0 ? (
          <p className="border-y border-line py-5 text-ink-soft">No staff accounts yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-lg font-semibold">{user.name}</p>
                  <p className="text-ink-soft">{user.designation} · {user.role === "volunteer" ? "Volunteer" : "Staff"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${user.active ? "" : "!bg-alert !text-white"}`}>{user.active ? "Active" : "Inactive"}</span>
                  <button className="btn btn-quiet" disabled={busy} onClick={() => toggle(user)}>
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
