/**
 * Pure queue logic: no database, no clock, no I/O.
 * Everything here is unit-tested in tests/engine.test.ts.
 */
import type { PriorityReason } from "@/lib/db/schema";

export type RegistrationSource = "self" | "desk" | "booking";

export const SENIOR_AGE = 60;

/** Lower rank is served first. */
export function priorityRank(reason: PriorityReason): 0 | 1 | 2 {
  if (reason === "emergency") return 0;
  if (reason === "none") return 2;
  return 1;
}

/**
 * Works out the priority a new patient gets.
 * - Anyone aged 60+ is treated as a senior automatically.
 * - Only desk staff can mark an emergency; a self-registered "emergency" is
 *   downgraded so people cannot jump the queue from their phone.
 */
export function resolvePriority(
  age: number,
  requested: PriorityReason,
  source: RegistrationSource,
): PriorityReason {
  if (requested === "emergency") return source === "desk" ? "emergency" : "none";
  if (requested !== "none") return requested;
  return age >= SENIOR_AGE ? "senior" : "none";
}

export interface Orderable {
  id: number;
  priorityRank: number;
  queuedAt: number;
}

/** Priority first, then whoever has waited longest, then id as a stable tiebreak. */
export function compareEntries(a: Orderable, b: Orderable): number {
  return a.priorityRank - b.priorityRank || a.queuedAt - b.queuedAt || a.id - b.id;
}

export function sortQueue<T extends Orderable>(entries: T[]): T[] {
  return [...entries].sort(compareEntries);
}

/** 1-based position of `id` in the waiting list, or null if it is not waiting. */
export function positionOf<T extends Orderable>(waiting: T[], id: number): number | null {
  const idx = sortQueue(waiting).findIndex((e) => e.id === id);
  return idx === -1 ? null : idx + 1;
}

/**
 * Average service time for a station.
 * Early in a camp we have few samples, so the configured default counts as
 * `priorWeight` imaginary samples. As real measurements arrive they take over.
 * Only the most recent `window` samples are used so the estimate follows the
 * doctors getting faster or slower over the day.
 */
export function estimateServiceSeconds(
  defaultSeconds: number,
  samplesSeconds: number[],
  opts: { priorWeight?: number; window?: number } = {},
): number {
  const { priorWeight = 3, window = 20 } = opts;
  const recent = samplesSeconds.filter((s) => Number.isFinite(s) && s > 0).slice(-window);
  const total = defaultSeconds * priorWeight + recent.reduce((a, b) => a + b, 0);
  return total / (priorWeight + recent.length);
}

/**
 * Estimated wait for someone with `ahead` patients in front of them.
 * With several counters the line moves faster. If every counter is busy, a
 * patient at the front still waits on average half a service.
 */
export function estimateWaitSeconds(input: {
  ahead: number;
  counters: number;
  busyCounters: number;
  avgServiceSeconds: number;
}): number {
  const counters = Math.max(1, input.counters);
  const frontPenalty = input.busyCounters >= counters ? 0.5 : 0;
  return Math.round((input.ahead / counters + frontPenalty) * input.avgServiceSeconds);
}

export function formatLabel(prefix: string, number: number): string {
  return `${prefix.toUpperCase()}-${String(number).padStart(3, "0")}`;
}

export interface Slot {
  start: number;
  end: number;
  label: string;
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Slots for the local calendar day containing `day`. */
export function slotsForDay(
  camp: { opensAt: string; closesAt: string; slotMinutes: number },
  day: Date,
): Slot[] {
  const [oh, om] = camp.opensAt.split(":").map(Number);
  const [ch, cm] = camp.closesAt.split(":").map(Number);
  const open = new Date(day.getFullYear(), day.getMonth(), day.getDate(), oh, om).getTime();
  const close = new Date(day.getFullYear(), day.getMonth(), day.getDate(), ch, cm).getTime();
  const step = Math.max(5, camp.slotMinutes) * 60_000;
  const slots: Slot[] = [];
  for (let t = open; t + step <= close; t += step) {
    slots.push({ start: t, end: t + step, label: `${hhmm(new Date(t))} – ${hhmm(new Date(t + step))}` });
  }
  return slots;
}

/** Normalises Indian mobile numbers to E.164 (+91XXXXXXXXXX). Returns null if invalid. */
export function normalisePhone(raw: string, defaultCountryCode = "+91"): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return /^\+\d{10,14}$/.test(digits) ? digits : null;
  const local = digits.replace(/^0+/, "");
  if (defaultCountryCode === "+91") {
    const ten = local.length === 12 && local.startsWith("91") ? local.slice(2) : local;
    return /^[6-9]\d{9}$/.test(ten) ? `+91${ten}` : null;
  }
  return /^\d{7,12}$/.test(local) ? `${defaultCountryCode}${local}` : null;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}
