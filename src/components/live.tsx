"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to a Server-Sent Events endpoint. The browser reconnects by itself,
 * so a phone that drops signal for a minute simply catches up on return.
 */
export function useLive<T>(url: string, initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource(url);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("update", (e) => {
      try {
        setData(JSON.parse((e as MessageEvent).data) as T);
        setLive(true);
      } catch {
        /* ignore malformed frame */
      }
    });
    return () => es.close();
  }, [url]);

  return { data, live };
}

export function LivePill({ live }: { live: boolean }) {
  return (
    <span className="chip" role="status">
      <span aria-hidden className={`inline-block size-2.5 rounded-full ${live ? "bg-ok" : "bg-signal"}`} />
      {live ? "Live" : "Reconnecting"}
    </span>
  );
}

/** Re-renders every `ms` so elapsed-time text stays fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setNow(Date.now()), ms);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [ms]);
  return now;
}

export async function postJson<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}
