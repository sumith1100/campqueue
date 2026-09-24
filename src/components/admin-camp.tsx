"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { postJson, useLive } from "@/components/live";
import { formatDuration } from "@/lib/queue/engine";
import type { CampSnapshot } from "@/lib/queue/service";

interface StationRow {
  id: number;
  name: string;
  code: string;
  color: string;
  counters: number;
  defaultServiceSeconds: number;
  nextStationId: number | null;
  acceptsRegistration: boolean;
}

interface Analytics {
  totals: {
    registered: number;
    active: number;
    completed: number;
    cancelled: number;
    noShowEvents: number;
    priorityShare: number;
    avgWaitSeconds: number;
    avgServiceSeconds: number;
  };
  perStation: { id: number; name: string; color: string; served: number; waiting: number; noShows: number; avgWaitSeconds: number; avgServiceSeconds: number }[];
  arrivalsByHour: { hour: number; count: number }[];
}

export function AdminCamp({ camp, stations, initial }: { camp: { slug: string; name: string }; stations: StationRow[]; initial: CampSnapshot }) {
  const router = useRouter();
  const { data: snap } = useLive<CampSnapshot>(`/api/camps/${camp.slug}/stream`, initial);
  const [data, setData] = useState<Analytics | null>(null);
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setOrigin(process.env.NEXT_PUBLIC_BASE_URL || window.location.origin), []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/camps/${camp.slug}/analytics`, { cache: "no-store" });
    if (res.ok) setData((await res.json()) as Analytics);
  }, [camp.slug]);
  useEffect(() => void load(), [load, snap?.updatedAt]);

  async function patch(id: number, body: Record<string, unknown>) {
    setMsg(null);
    try {
      await postJson(`/api/admin/stations/${id}`, body, "PATCH");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
      router.refresh();
    }
  }

  const registerUrl = `${origin}/c/${camp.slug}`;
  const peak = Math.max(1, ...(data?.arrivalsByHour.map((h) => h.count) ?? [1]));

  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-5 pb-24 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link className="font-semibold underline" href="/admin">
            All camps
          </Link>
          <h1 className="mt-2 text-4xl font-bold">{camp.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-quiet" href={`/staff/${camp.slug}`}>
            Volunteer console
          </Link>
          <Link className="btn btn-quiet" href={`/display/${camp.slug}`} target="_blank">
            Display screen
          </Link>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center" aria-labelledby="share">
        <div className="w-fit rounded-2xl bg-white p-4">
          {origin ? <QRCodeSVG value={registerUrl} size={176} marginSize={0} /> : <div className="size-44" />}
        </div>
        <div className="grid gap-3">
          <h2 id="share" className="text-2xl font-bold">
            Put this code at the entrance
          </h2>
          <p className="text-ink-soft">Visitors scan it, pick a service and get a token. No app to install.</p>
          <label className="grid gap-1.5">
            <span className="font-semibold">Public address</span>
            <input className="field" value={origin} onChange={(e) => setOrigin(e.target.value.replace(/\/$/, ""))} />
          </label>
          <p className="break-all text-sm text-ink-soft">{registerUrl}</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-primary" href={`/admin/${camp.slug}/poster`} target="_blank" rel="noreferrer">
              Print the poster
            </a>
            <a className="btn btn-quiet" href={registerUrl} target="_blank" rel="noreferrer">
              Open the sign-up page
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="today" className="grid gap-5">
        <h2 id="today" className="text-2xl font-bold">
          Today
        </h2>
        {data && (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Registered", data.totals.registered],
                ["In line or with staff", data.totals.active],
                ["Finished", data.totals.completed],
                ["Average wait", data.totals.avgWaitSeconds ? formatDuration(data.totals.avgWaitSeconds) : "–"],
                ["Average visit", data.totals.avgServiceSeconds ? formatDuration(data.totals.avgServiceSeconds) : "–"],
                ["Skipped calls", data.totals.noShowEvents],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dd className="token-numeral text-4xl">{v}</dd>
                  <dt className="text-sm text-ink-soft">{k}</dt>
                </div>
              ))}
            </dl>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <thead className="border-b-2 border-ink text-sm text-ink-soft">
                  <tr>
                    <th className="py-2 font-semibold">Station</th>
                    <th className="py-2 font-semibold">Seen</th>
                    <th className="py-2 font-semibold">Waiting</th>
                    <th className="py-2 font-semibold">Average wait</th>
                    <th className="py-2 font-semibold">Average visit</th>
                    <th className="py-2 font-semibold">Skipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.perStation.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 font-semibold">
                        <span aria-hidden className="mr-2 inline-block size-3 rounded-sm" style={{ background: s.color }} />
                        {s.name}
                      </td>
                      <td>{s.served}</td>
                      <td>{s.waiting}</td>
                      <td>{s.avgWaitSeconds ? formatDuration(s.avgWaitSeconds) : "–"}</td>
                      <td>{s.avgServiceSeconds ? formatDuration(s.avgServiceSeconds) : "–"}</td>
                      <td>{s.noShows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.arrivalsByHour.length > 0 && (
              <figure className="grid gap-2">
                <figcaption className="font-semibold">When people registered</figcaption>
                <div className="flex h-36 items-end gap-2" role="img" aria-label="Registrations per hour">
                  {data.arrivalsByHour.map((h) => (
                    <div key={h.hour} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-sm tabular-nums">{h.count}</span>
                      <div className="w-full rounded-t-md bg-action" style={{ height: `${Math.max(6, (h.count / peak) * 100)}px` }} />
                      <span className="text-sm text-ink-soft tabular-nums">{String(h.hour).padStart(2, "0")}h</span>
                    </div>
                  ))}
                </div>
              </figure>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="stations" className="grid gap-4">
        <h2 id="stations" className="text-2xl font-bold">
          Stations and patient flow
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead className="border-b-2 border-ink text-sm text-ink-soft">
              <tr>
                <th className="py-2 font-semibold">Station</th>
                <th className="py-2 font-semibold">Counters</th>
                <th className="py-2 font-semibold">Usual visit (sec)</th>
                <th className="py-2 font-semibold">Then goes to</th>
                <th className="py-2 font-semibold">Visitors can pick it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stations.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 font-semibold">
                    <span aria-hidden className="mr-2 inline-block size-3 rounded-sm" style={{ background: s.color }} />
                    {s.name} <span className="font-normal text-ink-soft">({s.code})</span>
                  </td>
                  <td>
                    <input aria-label={`Counters at ${s.name}`} className="field !min-h-10 !w-20" type="number" min={1} max={20} defaultValue={s.counters} onBlur={(e) => Number(e.target.value) !== s.counters && patch(s.id, { counters: Number(e.target.value) })} />
                  </td>
                  <td>
                    <input aria-label={`Usual visit at ${s.name}`} className="field !min-h-10 !w-24" type="number" min={30} max={3600} step={30} defaultValue={s.defaultServiceSeconds} onBlur={(e) => Number(e.target.value) !== s.defaultServiceSeconds && patch(s.id, { defaultServiceSeconds: Number(e.target.value) })} />
                  </td>
                  <td>
                    <select aria-label={`Next stop after ${s.name}`} className="field !min-h-10" value={s.nextStationId ?? ""} onChange={(e) => patch(s.id, { nextStationId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Journey ends</option>
                      {stations.filter((o) => o.id !== s.id).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input aria-label={`Visitors can pick ${s.name}`} type="checkbox" className="size-5 accent-ink" checked={s.acceptsRegistration} onChange={(e) => patch(s.id, { acceptsRegistration: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p aria-live="polite" className="min-h-6 font-semibold text-alert">
          {msg}
        </p>

        <form
          className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            setMsg(null);
            try {
              await postJson(`/api/admin/camps/${camp.slug}/stations`, {
                name: f.get("name"),
                code: f.get("code"),
                counters: Number(f.get("counters")),
                color: f.get("color"),
              });
              form.reset();
              router.refresh();
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Could not add the station");
            }
          }}
        >
          <label className="grid gap-1.5">
            <span className="font-semibold">Add a station</span>
            <input name="name" className="field" placeholder="Physiotherapy" required minLength={2} />
          </label>
          <label className="grid gap-1.5">
            <span className="font-semibold">Code</span>
            <input name="code" className="field uppercase" placeholder="PHY" required maxLength={5} />
          </label>
          <label className="grid gap-1.5">
            <span className="font-semibold">Counters</span>
            <input name="counters" type="number" min={1} defaultValue={1} className="field" />
          </label>
          <div className="flex items-end gap-2">
            <input name="color" type="color" defaultValue="#0a6f72" aria-label="Station colour" className="h-12 w-14 cursor-pointer rounded-lg border-2 border-line bg-white p-1" />
            <button className="btn btn-primary">Add</button>
          </div>
        </form>
      </section>

      <section aria-labelledby="after" className="grid gap-3">
        <h2 id="after" className="text-2xl font-bold">
          After the camp
        </h2>
        <p className="max-w-prose text-ink-soft">The export has queue timings only, with no names or phone numbers. Remove personal details once the camp is over.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-quiet" href={`/api/admin/camps/${camp.slug}/export`}>
            Download queue log (CSV)
          </a>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (!confirm("This permanently removes every visitor's name and phone number for this camp. Continue?")) return;
              try {
                const r = await postJson<{ anonymised: number }>(`/api/admin/camps/${camp.slug}/anonymise`);
                setMsg(`Removed personal details for ${r.anonymised} visitors`);
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Could not remove details");
              }
            }}
          >
            Remove names and phone numbers
          </button>
        </div>
      </section>
    </div>
  );
}
