"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LangSwitch } from "@/components/lang-switch";
import { postJson } from "@/components/live";
import { t, type Lang } from "@/lib/i18n";
import type { PriorityReason } from "@/lib/db/schema";

export interface FormStation {
  id: number;
  name: string;
  code: string;
  color: string;
  waiting: number;
  waitMinutes: number;
  isPaused: boolean;
}
export interface FormSlot {
  start: number;
  label: string;
  left: number;
}

interface Props {
  campSlug: string;
  stations: FormStation[];
  slots: FormSlot[];
  /** Volunteer mode: signed-in staff registering someone standing at the desk. */
  desk?: boolean;
}

export function RegisterForm({ campSlug, stations, slots, desk = false }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [stationId, setStationId] = useState<number | null>(stations.find((s) => !s.isPaused)?.id ?? null);
  const [mode, setMode] = useState<"now" | "slot">("now");
  const [slot, setSlot] = useState<number | null>(null);
  const [priority, setPriority] = useState<PriorityReason>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ label: string; url: string; name: string; station: string } | null>(null);

  const canBook = !desk && slots.length > 0;
  const priorities: { value: PriorityReason; label: string }[] = [
    { value: "none", label: t(lang, "priorityNone") },
    { value: "senior", label: t(lang, "prioritySenior") },
    { value: "pregnant", label: t(lang, "priorityPregnant") },
    { value: "differently_abled", label: t(lang, "priorityAbled") },
    ...(desk ? [{ value: "emergency" as const, label: "Emergency" }] : []),
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (!stationId) return setError("Choose a service");
    if (mode === "slot" && !slot) return setError(t(lang, "bookSlot"));
    setBusy(true);
    try {
      const res = await postJson<{ label: string; url: string }>("/api/register", {
        campSlug,
        stationId,
        name: String(form.get("name") ?? ""),
        age: Number(form.get("age")),
        phone: String(form.get("phone") ?? "") || undefined,
        language: lang,
        priority,
        scheduledFor: mode === "slot" && slot ? slot : undefined,
        desk: desk || undefined,
      });
      if (desk) {
        setIssued({
          ...res,
          name: String(form.get("name")),
          station: stations.find((s) => s.id === stationId)?.name ?? "",
        });
        (e.target as HTMLFormElement).reset();
        setPriority("none");
      } else {
        router.push(res.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      {issued && (
        <div className="ticket p-6" role="status">
          <p className="text-ink-soft">
            {issued.name} · {issued.station}
          </p>
          <p className="token-numeral text-7xl">{issued.label}</p>
          <div className="mt-4 flex flex-wrap gap-3 no-print">
            <button className="btn btn-primary" onClick={() => window.print()}>
              Print slip
            </button>
            <a className="btn btn-quiet" href={issued.url} target="_blank" rel="noreferrer">
              Open patient view
            </a>
            <button className="btn btn-quiet" onClick={() => setIssued(null)}>
              Register next patient
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className={`grid gap-6 ${issued ? "no-print" : ""}`} noValidate>
        {!desk && <LangSwitch value={lang} onChange={setLang} />}

        <label className="grid gap-1.5">
          <span className="font-semibold">{t(lang, "name")}</span>
          <input name="name" className="field" autoComplete="name" required minLength={2} maxLength={80} />
        </label>

        <div className="grid grid-cols-[7rem_1fr] gap-4">
          <label className="grid gap-1.5">
            <span className="font-semibold">{t(lang, "age")}</span>
            <input name="age" className="field" inputMode="numeric" pattern="[0-9]*" required maxLength={3} />
          </label>
          <label className="grid gap-1.5">
            <span className="font-semibold">{t(lang, "phone")}</span>
            <input name="phone" className="field" type="tel" inputMode="tel" autoComplete="tel" maxLength={16} />
          </label>
        </div>
        <p className="-mt-3 text-sm text-ink-soft">{t(lang, "phoneHint")}</p>

        <fieldset className="grid gap-2">
          <legend className="mb-1 font-semibold">{t(lang, "service")}</legend>
          {stations.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-surface p-3 ${
                stationId === s.id ? "border-ink" : "border-line"
              } ${s.isPaused ? "opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="station"
                className="size-5 accent-ink"
                checked={stationId === s.id}
                disabled={s.isPaused}
                onChange={() => setStationId(s.id)}
              />
              <span aria-hidden className="size-4 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="grow font-semibold">{s.name}</span>
              <span className="text-sm text-ink-soft">
                {s.isPaused ? "Paused" : s.waiting === 0 ? "No wait" : `${s.waiting} waiting · ~${s.waitMinutes} min`}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 font-semibold">{t(lang, "priority")}</legend>
          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => (
              <label
                key={p.value}
                className={`cursor-pointer rounded-xl border-2 px-3 py-2 font-semibold ${
                  priority === p.value ? "border-ink bg-ink text-white" : "border-line bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  className="sr-only"
                  checked={priority === p.value}
                  onChange={() => setPriority(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        {canBook && (
          <fieldset className="grid gap-3">
            <div className="inline-flex w-fit rounded-xl border-2 border-line bg-surface p-0.5" role="group">
              {(["now", "slot"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-10 rounded-[0.55rem] px-3 font-semibold ${mode === m ? "bg-ink text-white" : ""}`}
                >
                  {m === "now" ? t(lang, "walkIn") : t(lang, "bookSlot")}
                </button>
              ))}
            </div>
            {mode === "slot" && (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    disabled={s.left <= 0}
                    aria-pressed={slot === s.start}
                    onClick={() => setSlot(s.start)}
                    className={`rounded-xl border-2 px-3 py-2 font-semibold disabled:opacity-40 ${
                      slot === s.start ? "border-ink bg-ink text-white" : "border-line bg-surface"
                    }`}
                  >
                    {s.label}
                    <span className="ml-2 text-sm font-normal opacity-80">{s.left <= 0 ? "full" : `${s.left} left`}</span>
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <div aria-live="polite" className="min-h-6 font-semibold text-alert">
          {error}
        </div>
        <button className="btn btn-primary text-lg" disabled={busy || !stationId}>
          {busy ? "…" : t(lang, "submit")}
        </button>
      </form>
    </div>
  );
}
