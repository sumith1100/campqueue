"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LivePill, postJson, useLive, useNow } from "@/components/live";
import type { PriorityReason, Station } from "@/lib/db/schema";
import type { CampSnapshot, QueueRow } from "@/lib/queue/service";

interface QueueData {
  station: Station;
  avgServiceSeconds: number;
  active: QueueRow[];
  waiting: QueueRow[];
}

interface Props {
  camp: { slug: string; name: string; graceMinutes: number };
  stations: { id: number; name: string; color: string; counters: number; nextStationId: number | null }[];
  initial: CampSnapshot;
  staff?: { name: string; designation: string };
}

const REASON: Record<PriorityReason, string | null> = {
  none: null,
  senior: "Senior",
  pregnant: "Pregnant",
  differently_abled: "Differently abled",
  emergency: "Emergency",
};

function PriorityChip({ reason }: { reason: PriorityReason }) {
  const label = REASON[reason];
  if (!label) return null;
  return <span className={`chip ${reason === "emergency" ? "!bg-alert !text-white" : ""}`}>{label}</span>;
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, "0")}`;

export function StaffConsole({ camp, stations, initial }: Props) {
  const router = useRouter();
  const { data: snap, live } = useLive<CampSnapshot>(`/api/camps/${camp.slug}/stream`, initial);
  const now = useNow(1000);

  const [stationId, setStationId] = useState(stations[0]?.id ?? 0);
  const [counter, setCounter] = useState(1);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState("default");
  const [checkinLabel, setCheckinLabel] = useState("");

  const station = stations.find((s) => s.id === stationId);
  const version = snap?.updatedAt;

  const load = useCallback(async () => {
    if (!stationId) return;
    const res = await fetch(`/api/staff/stations/${stationId}/queue`, { cache: "no-store" });
    if (res.status === 401) return router.replace(`/login?next=/staff/${camp.slug}`);
    if (res.ok) setQueue((await res.json()) as QueueData);
  }, [stationId, camp.slug, router]);

  useEffect(() => {
    void load();
  }, [load, version]);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(`cq:counter:${stationId}`));
      setCounter(saved >= 1 && station && saved <= station.counters ? saved : 1);
    } catch {
      setCounter(1);
    }
  }, [stationId, station]);

  const mine = queue?.active.find((a) => a.counter === counter) ?? null;
  useEffect(() => setSendTo("default"), [mine?.entryId]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const next = queue?.waiting[0];
  const graceLeft = mine?.status === "called" && mine.calledAt ? camp.graceMinutes * 60 - Math.floor((now - mine.calledAt) / 1000) : null;
  const nextName = station?.nextStationId ? stations.find((s) => s.id === station.nextStationId)?.name : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 pt-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{camp.name}</h1>
          <p className="text-ink-soft">{staff?.designation ? `${staff.name} · ${staff.designation}` : "Volunteer console"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LivePill live={live} />
          <Link className="btn btn-quiet" href={`/staff/${camp.slug}/register`}>
            Register a walk-in
          </Link>
          <Link className="btn btn-quiet" href={`/display/${camp.slug}`} target="_blank">
            Display
          </Link>
          <button
            className="btn btn-quiet"
            onClick={async () => {
              await postJson("/api/auth/logout");
              router.push("/login");
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <nav aria-label="Stations" className="flex gap-2 overflow-x-auto pb-1">
        {stations.map((s) => {
          const st = snap?.stations.find((x) => x.id === s.id);
          return (
            <button
              key={s.id}
              aria-pressed={s.id === stationId}
              onClick={() => setStationId(s.id)}
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl border-2 px-4 font-semibold ${
                s.id === stationId ? "border-ink bg-surface" : "border-transparent bg-white/60 hover:bg-surface"
              }`}
            >
              <span aria-hidden className="size-3.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
              <span className="chip">{st?.waiting ?? 0}</span>
              {st?.isPaused && <span className="chip !bg-signal">Paused</span>}
            </button>
          );
        })}
      </nav>

      {station && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          <section className="ticket" aria-label="Your counter">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-white" style={{ background: station.color }}>
              <h2 className="text-2xl font-bold">{station.name}</h2>
              {station.counters > 1 && (
                <div role="group" aria-label="Counter" className="flex items-center gap-1.5">
                  <span className="mr-1 opacity-90">Counter</span>
                  {Array.from({ length: station.counters }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      aria-pressed={counter === n}
                      onClick={() => {
                        setCounter(n);
                        try {
                          localStorage.setItem(`cq:counter:${stationId}`, String(n));
                        } catch {
                          /* private mode */
                        }
                      }}
                      className={`size-10 rounded-lg font-bold ${counter === n ? "bg-white text-ink" : "bg-white/20 text-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 px-6 py-6">
              {mine ? (
                <>
                  <div>
                    <p className="token-numeral text-8xl">{mine.label}</p>
                    <p className="mt-2 text-xl font-semibold">
                      {mine.name}, {mine.age}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityChip reason={mine.priorityReason} />
                      {mine.status === "called" && graceLeft !== null && (
                        <span className={`chip ${graceLeft <= 0 ? "!bg-alert !text-white" : ""}`}>
                          {graceLeft > 0 ? `Waiting for patient ${mmss(graceLeft)}` : "Grace time is over. You can skip."}
                        </span>
                      )}
                      {mine.status === "serving" && mine.startedAt && (
                        <span className="chip">With patient {mmss(Math.floor((now - mine.startedAt) / 1000))}</span>
                      )}
                    </div>
                  </div>

                  {mine.status === "called" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button className="btn btn-primary" disabled={busy} onClick={() => run(() => postJson(`/api/staff/entries/${mine.entryId}/start`))}>
                        Patient is here
                      </button>
                      <button className="btn btn-quiet" disabled={busy} onClick={() => run(() => postJson(`/api/staff/entries/${mine.entryId}/recall`))}>
                        Call again
                      </button>
                      <button className="btn btn-danger" disabled={busy} onClick={() => run(() => postJson(`/api/staff/entries/${mine.entryId}/no-show`, { requeue: true }))}>
                        Did not come, move back
                      </button>
                      <button className="btn btn-danger" disabled={busy} onClick={() => run(() => postJson(`/api/staff/entries/${mine.entryId}/no-show`, { requeue: false }))}>
                        Did not come, remove
                      </button>
                    </div>
                  ) : null}

                  <div className="grid gap-2 border-t border-line pt-4">
                    <label className="grid gap-1.5">
                      <span className="font-semibold">When done, send to</span>
                      <select className="field" value={sendTo} onChange={(e) => setSendTo(e.target.value)}>
                        <option value="default">{nextName ? `${nextName} (usual next stop)` : "Finish here (usual)"}</option>
                        {nextName && <option value="end">Finish here</option>}
                        {stations
                          .filter((s) => s.id !== station.id && s.id !== station.nextStationId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="btn btn-signal text-lg"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          postJson(`/api/staff/entries/${mine.entryId}/complete`, {
                            forwardTo: sendTo === "default" ? undefined : sendTo === "end" ? null : Number(sendTo),
                          }),
                        )
                      }
                    >
                      Done with {mine.label}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-ink-soft">{next ? "Up next" : "Nobody is waiting"}</p>
                    {next && (
                      <>
                        <p className="token-numeral text-8xl">{next.label}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
                          {next.name}, {next.age} <PriorityChip reason={next.priorityReason} />
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    className="btn btn-primary text-xl"
                    disabled={busy || !next || snap?.stations.find((s) => s.id === station.id)?.isPaused}
                    onClick={() =>
                      run(async () => {
                        const r = await postJson<{ called: unknown }>(`/api/staff/stations/${station.id}/call`, { counter });
                        if (!r.called) setMsg("Nobody is waiting");
                      })
                    }
                  >
                    Call next
                  </button>
                </>
              )}

              <p aria-live="polite" className="min-h-6 font-semibold text-alert">
                {msg}
              </p>
            </div>

            <div className="perf" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <p className="text-ink-soft">Average visit here: {queue ? mmss(queue.avgServiceSeconds) : "–"}</p>
              <button
                className="btn btn-quiet"
                disabled={busy}
                onClick={() => run(() => postJson(`/api/staff/stations/${station.id}/pause`, { paused: !snap?.stations.find((s) => s.id === station.id)?.isPaused }))}
              >
                {snap?.stations.find((s) => s.id === station.id)?.isPaused ? "Resume this station" : "Pause this station"}
              </button>
            </div>
          </section>

          <section aria-label="Waiting list" className="grid content-start gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-bold">Waiting</h2>
              <span className="text-ink-soft">{queue?.waiting.length ?? 0} in line</span>
            </div>
            {queue && queue.waiting.length === 0 ? (
              <p className="border-y border-line py-6 text-ink-soft">The line is empty.</p>
            ) : (
              <ol className="divide-y divide-line border-y border-line">
                {queue?.waiting.map((w, i) => (
                  <li key={w.entryId} className="flex items-center gap-3 py-3">
                    <span className="w-6 text-right text-ink-soft tabular-nums">{i + 1}</span>
                    <span className="token-numeral w-24 text-2xl">{w.label}</span>
                    <span className="grow">
                      {w.name}, {w.age}
                    </span>
                    <PriorityChip reason={w.priorityReason} />
                    <span className="w-14 text-right text-sm text-ink-soft tabular-nums">{Math.max(0, Math.floor((now - w.queuedAt) / 60000))} min</span>
                  </li>
                ))}
              </ol>
            )}

            <form
              className="grid gap-2 border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await postJson("/api/staff/checkin", { campSlug: camp.slug, label: checkinLabel });
                  setMsg(`${checkinLabel.toUpperCase()} checked in`);
                  setCheckinLabel("");
                });
              }}
            >
              <label className="font-semibold" htmlFor="checkin">
                Check in a pre-booked patient
              </label>
              <div className="flex gap-2">
                <input id="checkin" className="field" placeholder="GEN-012" value={checkinLabel} onChange={(e) => setCheckinLabel(e.target.value)} autoCapitalize="characters" required />
                <button className="btn btn-quiet" disabled={busy}>
                  Check in
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
