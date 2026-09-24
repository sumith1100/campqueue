"use client";

import { useEffect, useRef, useState } from "react";
import { LangSwitch } from "@/components/lang-switch";
import { LivePill, postJson, useLive, useNow } from "@/components/live";
import { isLang, t, type Lang } from "@/lib/i18n";
import { formatDuration } from "@/lib/queue/engine";
import type { TokenStatus } from "@/lib/queue/service";

export function TokenTracker({ initial }: { initial: TokenStatus }) {
  const { data, live } = useLive<TokenStatus>(`/api/tokens/${initial.token.publicId}/stream`, initial);
  const s = data ?? initial;
  const [lang, setLang] = useState<Lang>(isLang(initial.token.language) ? initial.token.language : "en");
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const now = useNow(1000);

  const { stage, token } = s;
  const called = stage.status === "called";

  // Buzz the phone and change the tab title the moment we are called.
  const wasCalled = useRef(called);
  useEffect(() => {
    if (called && !wasCalled.current) {
      try {
        navigator.vibrate?.([250, 120, 250, 120, 400]);
      } catch {
        /* not supported */
      }
    }
    wasCalled.current = called;
    document.title = called ? `${token.label} · ${t(lang, "yourTurn")}` : `${token.label} · CampQueue`;
  }, [called, token.label, lang]);

  async function act(action: "checkin" | "cancel") {
    setError(null);
    try {
      await postJson(`/api/tokens/${token.publicId}/${action}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const graceLeft =
    called && stage.calledAt ? Math.max(0, s.camp.graceMinutes * 60 - Math.floor((now - stage.calledAt) / 1000)) : null;
  const closed = token.status !== "active";

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <LangSwitch value={lang} onChange={setLang} />
        <LivePill live={live} />
      </div>

      <article className="ticket" aria-live="polite">
        <div className="px-6 pb-5 pt-5 text-white" style={{ background: stage.stationColor }}>
          <p className="text-lg font-semibold">{s.camp.name}</p>
          <p className="opacity-90">{stage.stationName}</p>
        </div>

        <div className="px-6 pb-6 pt-5">
          <p className="text-ink-soft">{t(lang, "yourToken")}</p>
          <p className="token-numeral text-[5.5rem] sm:text-[7rem]">{token.label}</p>
          <p className="mt-1 text-ink-soft">{token.name}</p>
        </div>

        <div className="perf" />

        <div className="px-6 pb-6 pt-6">
          {called && (
            <div className="your-turn rounded-2xl bg-signal p-5 text-ink">
              <p className="font-display text-3xl font-bold leading-tight">{t(lang, "yourTurn")}</p>
              <p className="mt-2 text-lg">
                {t(lang, "goTo")} <strong>{stage.stationName}</strong>
                {stage.counter ? (
                  <>
                    , {t(lang, "counter")} <strong>{stage.counter}</strong>
                  </>
                ) : null}
              </p>
              {graceLeft !== null && (
                <p className="mt-2 text-sm">
                  {Math.floor(graceLeft / 60)}:{String(graceLeft % 60).padStart(2, "0")}
                </p>
              )}
            </div>
          )}

          {stage.status === "serving" && (
            <p className="font-display text-3xl font-bold">
              {stage.stationName}
              {stage.counter ? ` · ${t(lang, "counter")} ${stage.counter}` : ""}
            </p>
          )}

          {stage.status === "waiting" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-ink-soft">{t(lang, "position")}</p>
                <p className="token-numeral text-6xl">{stage.position}</p>
              </div>
              <div>
                <p className="text-ink-soft">{t(lang, "waitAbout")}</p>
                <p className="font-display text-4xl font-bold leading-none">
                  {formatDuration(stage.etaSeconds ?? 0)}
                </p>
              </div>
            </div>
          )}

          {stage.status === "booked" && (
            <div className="grid gap-3">
              <p className="font-display text-2xl font-bold">
                {t(lang, "booked")}
                {token.scheduledFor
                  ? ` · ${new Date(token.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </p>
              <button className="btn btn-primary" onClick={() => act("checkin")}>
                {t(lang, "arrived")}
              </button>
            </div>
          )}

          {stage.status === "done" && closed && <p className="text-xl font-semibold">{t(lang, "done")}</p>}
          {token.status === "cancelled" && (
            <p className="text-xl font-semibold">
              {stage.status === "no_show" ? t(lang, "skipped") : t(lang, "cancelled")}
            </p>
          )}

          {(stage.status === "waiting" || called || stage.status === "serving") && stage.nowServing.length > 0 && (
            <p className="mt-5 border-t border-line pt-4">
              <span className="text-ink-soft">{t(lang, "nowServing")}: </span>
              <span className="token-numeral text-2xl">{stage.nowServing.join(" · ")}</span>
            </p>
          )}

          {stage.nextStationName && !closed && (
            <p className="mt-3 text-ink-soft">
              {t(lang, "nextStop")}: {stage.nextStationName}
            </p>
          )}

          {s.journey.length > 1 && (
            <ol className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 text-sm">
              {s.journey
                .filter((j) => j.status !== "no_show")
                .map((j, i, arr) => (
                  <li key={i} className={`chip ${i === arr.length - 1 && !closed ? "!bg-ink !text-white" : ""}`}>
                    {j.status === "done" ? "✓ " : ""}
                    {j.stationName}
                  </li>
                ))}
            </ol>
          )}
        </div>
      </article>

      {(stage.status === "waiting" || stage.status === "booked") && (
        <div className="flex flex-wrap items-center gap-3">
          {confirmingCancel ? (
            <>
              <button className="btn btn-danger" onClick={() => act("cancel")}>
                {t(lang, "cancel")}
              </button>
              <button className="btn btn-quiet" onClick={() => setConfirmingCancel(false)}>
                {t(lang, "keep")}
              </button>
            </>
          ) : (
            <button className="btn btn-quiet" onClick={() => setConfirmingCancel(true)}>
              {t(lang, "cancel")}
            </button>
          )}
        </div>
      )}
      <p aria-live="polite" className="font-semibold text-alert">
        {error}
      </p>
    </div>
  );
}
