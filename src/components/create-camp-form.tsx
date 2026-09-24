"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/live";

export function CreateCampForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const r = await postJson<{ slug: string }>("/api/admin/camps", {
            name: f.get("name"),
            venue: f.get("venue") || "",
            opensAt: f.get("opensAt"),
            closesAt: f.get("closesAt"),
            slotMinutes: Number(f.get("slotMinutes")),
            slotCapacity: Number(f.get("slotCapacity")),
            preset: f.get("preset"),
          });
          router.push(`/admin/${r.slug}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not create the camp");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-1.5">
        <span className="font-semibold">Camp name</span>
        <input name="name" className="field" required minLength={3} placeholder="Free health check-up, Malleswaram" />
      </label>
      <label className="grid gap-1.5">
        <span className="font-semibold">Venue</span>
        <input name="venue" className="field" placeholder="Community hall, 8th Cross" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-1.5">
          <span className="font-semibold">Opens</span>
          <input name="opensAt" type="time" defaultValue="09:00" className="field" required />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Closes</span>
          <input name="closesAt" type="time" defaultValue="17:00" className="field" required />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Booking slot (minutes)</span>
          <input name="slotMinutes" type="number" min={10} max={120} defaultValue={30} className="field" />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">People per slot</span>
          <input name="slotCapacity" type="number" min={1} defaultValue={10} className="field" />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="font-semibold">Start with</span>
        <select name="preset" className="field" defaultValue="general">
          <option value="general">General camp: screening, physician, pharmacy, eye, dental</option>
          <option value="blank">Empty camp, I will add stations</option>
        </select>
      </label>
      <p aria-live="polite" className="min-h-6 font-semibold text-alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        Create camp
      </button>
    </form>
  );
}
