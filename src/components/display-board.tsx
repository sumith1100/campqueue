"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LivePill, useLive, useNow } from "@/components/live";
import { dictionaries, fill, LANGUAGES, type Lang } from "@/lib/i18n";
import { formatDuration } from "@/lib/queue/engine";
import type { CampSnapshot } from "@/lib/queue/service";

/** "GEN-042" -> "G E N, 0 4 2" so speech engines read it out letter by letter. */
const spell = (label: string) => label.replace(/-/g, "").split("").join(" ");

export function DisplayBoard({ initial }: { initial: CampSnapshot }) {
  const { data, live } = useLive<CampSnapshot>(`/api/camps/${initial.camp.slug}/stream`, initial);
  const snap = data ?? initial;
  const now = useNow(15_000);

  const [voice, setVoice] = useState(false);
  const [langs, setLangs] = useState<Lang[]>(["en"]);
  const spoken = useRef(new Map<string, number>());
  const primed = useRef(false);

  const speak = useCallback(
    (label: string, station: string, counter: number | null) => {
      if (!("speechSynthesis" in window)) return;
      for (const code of langs) {
        const meta = LANGUAGES.find((l) => l.code === code)!;
        const u = new SpeechSynthesisUtterance(
          fill(dictionaries[code].announce, { label: spell(label), station, counter: counter ?? "" }),
        );
        u.lang = meta.speech;
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
    },
    [langs],
  );

  // Announce each newly called token once (and again if staff press Recall).
  useEffect(() => {
    const seen = spoken.current;
    for (const st of snap.stations) {
      for (const a of st.active) {
        if (a.status !== "called") continue;
        const key = `${st.id}:${a.label}`;
        if (seen.get(key) === a.calledAt) continue;
        seen.set(key, a.calledAt);
        if (voice && primed.current) speak(a.label, st.name, a.counter);
      }
    }
    primed.current = true; // do not read out everything already on screen at page load
  }, [snap, voice, speak]);

  const clock = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const cols = snap.stations.length <= 2 ? "lg:grid-cols-2" : snap.stations.length <= 4 ? "lg:grid-cols-2 2xl:grid-cols-4" : "lg:grid-cols-3";

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-5xl">{snap.camp.name}</h1>
          {snap.camp.venue && <p className="text-ink-soft">{snap.camp.venue}</p>}
        </div>
        <div className="no-print flex flex-wrap items-center gap-3">
          <LivePill live={live} />
          <span className="font-display text-3xl font-bold tabular-nums">{clock}</span>
          <button
            className={`btn ${voice ? "btn-primary" : "btn-quiet"}`}
            aria-pressed={voice}
            onClick={() => {
              setVoice((v) => !v);
              if (!voice && "speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
            }}
          >
            {voice ? "Voice on" : "Turn on voice"}
          </button>
          {voice &&
            LANGUAGES.filter((l) => l.code !== "en").map((l) => (
              <label key={l.code} className="chip cursor-pointer !py-2">
                <input
                  type="checkbox"
                  checked={langs.includes(l.code)}
                  onChange={(e) => setLangs((cur) => (e.target.checked ? [...cur, l.code] : cur.filter((c) => c !== l.code)))}
                />
                {l.label}
              </label>
            ))}
          <button className="btn btn-quiet" onClick={() => document.documentElement.requestFullscreen?.()}>
            Full screen
          </button>
        </div>
      </header>

      <div className={`grid flex-1 auto-rows-fr gap-4 ${cols}`}>
        {snap.stations.map((st) => (
          <section key={st.id} className="flex flex-col rounded-3xl p-5 text-white sm:p-7" style={{ background: st.color }}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-bold sm:text-3xl">{st.name}</h2>
              {st.isPaused && <span className="rounded-full bg-white px-3 py-1 font-bold text-ink">Paused</span>}
            </div>

            <div className="my-4 flex flex-1 flex-col justify-center gap-3">
              {st.active.length === 0 ? (
                <p className="text-2xl opacity-90">{st.waiting > 0 ? "Calling the next token" : "No one waiting"}</p>
              ) : (
                st.active.map((a) => (
                  <div key={a.label} className="flex items-baseline justify-between gap-4">
                    <span className="token-numeral text-[clamp(3.5rem,9vw,7rem)]">{a.label}</span>
                    <span className="text-right text-xl font-semibold sm:text-2xl">
                      {a.counter ? `Counter ${a.counter}` : ""}
                      {a.status === "serving" && <span className="block text-base font-normal opacity-90">with the doctor</span>}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/40 pt-3 text-lg">
              {st.upNext.length > 0 && (
                <p>
                  Next: <span className="token-numeral text-2xl">{st.upNext.join("  ")}</span>
                </p>
              )}
              <p className="opacity-90">
                {st.waiting} waiting..{st.waiting > 0 ? ` · about ${formatDuration(st.newArrivalWaitSeconds)}` : ""}
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
