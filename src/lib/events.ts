import { EventEmitter } from "node:events";

/**
 * In-process pub/sub used to push live updates over Server-Sent Events.
 * Fine for a single server, which is how a camp runs. To scale out to several
 * servers, swap this for Redis pub/sub or Postgres LISTEN/NOTIFY.
 */
const g = globalThis as unknown as { __campqueueBus?: EventEmitter };

function bus(): EventEmitter {
  if (!g.__campqueueBus) {
    g.__campqueueBus = new EventEmitter();
    g.__campqueueBus.setMaxListeners(0);
  }
  return g.__campqueueBus;
}

export function publishCampChange(campId: number): void {
  bus().emit(`camp:${campId}`);
}

export function subscribeCamp(campId: number, listener: () => void): () => void {
  const key = `camp:${campId}`;
  bus().on(key, listener);
  return () => bus().off(key, listener);
}
