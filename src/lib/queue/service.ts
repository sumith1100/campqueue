import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  camps,
  entries,
  stations,
  tokens,
  type Camp,
  type Entry,
  type PriorityReason,
  type Station,
  type Token,
} from "@/lib/db/schema";
import { fill, dictionaries, isLang } from "@/lib/i18n";
import type { Notifier } from "@/lib/notify";
import {
  estimateServiceSeconds,
  estimateWaitSeconds,
  formatLabel,
  priorityRank,
  resolvePriority,
  sortQueue,
  type RegistrationSource,
} from "./engine";

export class QueueError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "bad_request",
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

export interface RegisterInput {
  campId: number;
  stationId: number;
  name: string;
  age: number;
  phone?: string | null;
  language?: string;
  priority?: PriorityReason;
  source: RegistrationSource;
  scheduledFor?: number | null;
}

export interface StationSnapshot {
  id: number;
  name: string;
  code: string;
  color: string;
  counters: number;
  isPaused: boolean;
  acceptsRegistration: boolean;
  waiting: number;
  avgServiceSeconds: number;
  /** Wait for someone who joins this station right now. */
  newArrivalWaitSeconds: number;
  active: { label: string; counter: number | null; status: "called" | "serving"; calledAt: number }[];
  upNext: string[];
}

export interface CampSnapshot {
  camp: Pick<Camp, "id" | "slug" | "name" | "venue" | "graceMinutes" | "opensAt" | "closesAt" | "slotMinutes" | "slotCapacity">;
  stations: StationSnapshot[];
  updatedAt: number;
}

export interface TokenStatus {
  token: Pick<Token, "publicId" | "label" | "name" | "priorityReason" | "status" | "scheduledFor" | "language">;
  camp: Pick<Camp, "slug" | "name" | "venue" | "graceMinutes">;
  stage: {
    entryId: number;
    status: Entry["status"];
    stationId: number;
    stationName: string;
    stationColor: string;
    counter: number | null;
    calledAt: number | null;
    position: number | null;
    ahead: number | null;
    etaSeconds: number | null;
    nowServing: string[];
    nextStationName: string | null;
  };
  journey: { stationName: string; status: Entry["status"] }[];
  updatedAt: number;
}

export interface QueueRow {
  entryId: number;
  label: string;
  name: string;
  age: number;
  priorityReason: PriorityReason;
  hasPhone: boolean;
  status: Entry["status"];
  counter: number | null;
  queuedAt: number;
  calledAt: number | null;
  startedAt: number | null;
}

export function createQueueService(deps: {
  db: Db;
  now?: () => number;
  notifier?: Notifier | null;
  emit?: (campId: number) => void;
  baseUrl?: string;
}) {
  const { db } = deps;
  const now = deps.now ?? Date.now;
  const emit = deps.emit ?? (() => {});
  const baseUrl = (deps.baseUrl ?? "").replace(/\/$/, "");

  // ---------- lookups ----------

  const getCampBySlug = (slug: string) => db.select().from(camps).where(eq(camps.slug, slug)).get();
  const getCamp = (id: number) => db.select().from(camps).where(eq(camps.id, id)).get();
  const listCamps = () => db.select().from(camps).orderBy(desc(camps.createdAt)).all();
  const listStations = (campId: number, q: Q = db) =>
    q.select().from(stations).where(eq(stations.campId, campId)).orderBy(asc(stations.sortOrder), asc(stations.id)).all();
  const getStation = (id: number, q: Q = db) => q.select().from(stations).where(eq(stations.id, id)).get();

  function mustEntry(id: number, q: Q = db): Entry {
    const e = q.select().from(entries).where(eq(entries.id, id)).get();
    if (!e) throw new QueueError("Entry not found", 404, "not_found");
    return e;
  }

  const waitingAt = (stationId: number, q: Q = db) =>
    sortQueue(
      q
        .select()
        .from(entries)
        .where(and(eq(entries.stationId, stationId), eq(entries.status, "waiting")))
        .all(),
    );

  const activeAt = (stationId: number, q: Q = db) =>
    q
      .select()
      .from(entries)
      .where(and(eq(entries.stationId, stationId), inArray(entries.status, ["called", "serving"])))
      .all();

  function avgServiceSeconds(station: Station, q: Q = db): number {
    const rows = q
      .select({ s: entries.startedAt, e: entries.endedAt })
      .from(entries)
      .where(and(eq(entries.stationId, station.id), eq(entries.status, "done"), sql`${entries.startedAt} is not null`))
      .orderBy(desc(entries.endedAt))
      .limit(20)
      .all();
    const samples = rows.map((r) => ((r.e ?? 0) - (r.s ?? 0)) / 1000).reverse();
    return estimateServiceSeconds(station.defaultServiceSeconds, samples);
  }

  // ---------- camp setup ----------

  function createCamp(input: {
    slug: string;
    name: string;
    venue?: string;
    opensAt?: string;
    closesAt?: string;
    slotMinutes?: number;
    slotCapacity?: number;
    notifyAhead?: number;
    graceMinutes?: number;
  }): Camp {
    if (getCampBySlug(input.slug)) throw new QueueError("That camp address is already taken", 409, "slug_taken");
    return db
      .insert(camps)
      .values({ ...input, venue: input.venue ?? "", createdAt: now() })
      .returning()
      .get();
  }

  function addStation(input: {
    campId: number;
    name: string;
    code: string;
    color?: string;
    counters?: number;
    defaultServiceSeconds?: number;
    nextStationId?: number | null;
    acceptsRegistration?: boolean;
  }): Station {
    const code = input.code.toUpperCase();
    const clash = db
      .select()
      .from(stations)
      .where(and(eq(stations.campId, input.campId), eq(stations.code, code)))
      .get();
    if (clash) throw new QueueError(`Code ${code} is already used in this camp`, 409, "code_taken");
    const order = listStations(input.campId).length;
    const row = db
      .insert(stations)
      .values({ ...input, code, sortOrder: order })
      .returning()
      .get();
    emit(input.campId);
    return row;
  }

  function updateStation(
    id: number,
    patch: Partial<Pick<Station, "name" | "color" | "counters" | "defaultServiceSeconds" | "nextStationId" | "acceptsRegistration" | "isPaused">>,
  ): Station {
    const current = getStation(id);
    if (!current) throw new QueueError("Station not found", 404, "not_found");
    if (patch.nextStationId === id) throw new QueueError("A station cannot lead to itself", 400, "bad_flow");
    if (patch.nextStationId) {
      const target = getStation(patch.nextStationId);
      if (!target || target.campId !== current.campId) throw new QueueError("Next station must be in the same camp", 400, "bad_flow");
      // walk the chain to prevent loops
      let cursor: Station | undefined = target;
      for (let i = 0; cursor && i < 50; i++) {
        if (cursor.id === id) throw new QueueError("That would create a loop in the patient flow", 400, "bad_flow");
        cursor = cursor.nextStationId ? getStation(cursor.nextStationId) : undefined;
      }
    }
    const row = db.update(stations).set(patch).where(eq(stations.id, id)).returning().get();
    emit(current.campId);
    return row;
  }

  // ---------- registration ----------

  function countBookedInSlot(campId: number, slotStart: number, q: Q = db): number {
    const r = q
      .select({ n: sql<number>`count(*)` })
      .from(tokens)
      .where(and(eq(tokens.campId, campId), eq(tokens.scheduledFor, slotStart), sql`${tokens.status} != 'cancelled'`))
      .get();
    return r?.n ?? 0;
  }

  function register(input: RegisterInput): { token: Token; entry: Entry } {
    const result = db.transaction(
      (tx) => {
        const station = getStation(input.stationId, tx);
        if (!station || station.campId !== input.campId) throw new QueueError("Unknown service", 400, "bad_station");
        if (!station.acceptsRegistration && input.source !== "desk")
          throw new QueueError("This service is reached by referral only", 400, "referral_only");
        if (station.isPaused && input.source !== "desk")
          throw new QueueError("This service is paused for a moment. Please ask a volunteer.", 409, "paused");

        const t = now();
        const scheduledFor = input.source === "booking" ? (input.scheduledFor ?? null) : null;
        if (input.source === "booking") {
          if (!scheduledFor) throw new QueueError("Pick a time slot", 400, "slot_required");
          const camp = getCamp(input.campId)!;
          if (countBookedInSlot(input.campId, scheduledFor, tx) >= camp.slotCapacity)
            throw new QueueError("That slot is full. Please pick another.", 409, "slot_full");
        }

        const reason = resolvePriority(input.age, input.priority ?? "none", input.source);
        const last = tx
          .select({ n: sql<number>`coalesce(max(${tokens.number}), 0)` })
          .from(tokens)
          .where(and(eq(tokens.campId, input.campId), eq(tokens.prefix, station.code)))
          .get();
        const number = (last?.n ?? 0) + 1;

        const token = tx
          .insert(tokens)
          .values({
            campId: input.campId,
            publicId: randomBytes(6).toString("base64url"),
            prefix: station.code,
            number,
            label: formatLabel(station.code, number),
            name: input.name.trim(),
            age: input.age,
            phone: input.phone ?? null,
            language: isLang(input.language) ? input.language : "en",
            priorityReason: reason,
            source: input.source,
            scheduledFor,
            createdAt: t,
          })
          .returning()
          .get();

        const booked = scheduledFor !== null && scheduledFor > t;
        const entry = tx
          .insert(entries)
          .values({
            tokenId: token.id,
            stationId: station.id,
            campId: input.campId,
            status: booked ? "booked" : "waiting",
            priorityRank: priorityRank(reason),
            queuedAt: booked ? scheduledFor! : t,
            createdAt: t,
          })
          .returning()
          .get();
        return { token, entry };
      },
      { behavior: "immediate" },
    );
    afterChange(input.campId);
    return result;
  }

  /** Moves a pre-booked patient into the live queue. */
  function checkIn(tokenId: number): Entry {
    const entry = db.transaction(
      (tx) => {
        const token = tx.select().from(tokens).where(eq(tokens.id, tokenId)).get();
        if (!token) throw new QueueError("Token not found", 404, "not_found");
        const current = tx.select().from(entries).where(eq(entries.tokenId, tokenId)).orderBy(desc(entries.id)).get();
        if (!current || current.status !== "booked") throw new QueueError("This token is not waiting for check-in", 409, "not_booked");
        const t = now();
        // On-time and late arrivals are ordered by slot start; early ones by arrival.
        const queuedAt = Math.min(t, token.scheduledFor ?? t);
        return tx.update(entries).set({ status: "waiting", queuedAt }).where(eq(entries.id, current.id)).returning().get();
      },
      { behavior: "immediate" },
    );
    afterChange(entry.campId);
    return entry;
  }

  function cancelToken(tokenId: number): void {
    const campId = db.transaction(
      (tx) => {
        const token = tx.select().from(tokens).where(eq(tokens.id, tokenId)).get();
        if (!token) throw new QueueError("Token not found", 404, "not_found");
        const current = tx.select().from(entries).where(eq(entries.tokenId, tokenId)).orderBy(desc(entries.id)).get();
        if (!current || !["booked", "waiting"].includes(current.status))
          throw new QueueError("This token can no longer be cancelled", 409, "not_cancellable");
        tx.update(entries).set({ status: "cancelled", endedAt: now() }).where(eq(entries.id, current.id)).run();
        tx.update(tokens).set({ status: "cancelled" }).where(eq(tokens.id, tokenId)).run();
        return token.campId;
      },
      { behavior: "immediate" },
    );
    afterChange(campId);
  }

  // ---------- staff actions ----------

  /** Calls the next patient at a station. Returns null when nobody is waiting. */
  function callNext(stationId: number, counter: number): (Entry & { label: string }) | null {
    const called = db.transaction(
      (tx) => {
        const station = getStation(stationId, tx);
        if (!station) throw new QueueError("Station not found", 404, "not_found");
        if (station.isPaused) throw new QueueError("This station is paused", 409, "paused");
        if (counter < 1 || counter > station.counters) throw new QueueError("No such counter", 400, "bad_counter");
        const busy = activeAt(stationId, tx).find((e) => e.counter === counter);
        if (busy) throw new QueueError("Finish or skip the current patient first", 409, "counter_busy");

        const next = waitingAt(stationId, tx)[0];
        if (!next) return null;
        const row = tx
          .update(entries)
          .set({ status: "called", calledAt: now(), counter })
          .where(and(eq(entries.id, next.id), eq(entries.status, "waiting")))
          .returning()
          .get();
        const token = tx.select().from(tokens).where(eq(tokens.id, row.tokenId)).get()!;
        return { ...row, label: token.label, __token: token, __station: station };
      },
      { behavior: "immediate" },
    );
    if (!called) return null;
    const { __token, __station, ...entry } = called;
    sendCalledSms(__token, __station, entry.counter);
    afterChange(entry.campId);
    return entry;
  }

  /** Shows the token on the display again and refreshes the grace timer. */
  function recall(entryId: number): Entry {
    const e = mustEntry(entryId);
    if (e.status !== "called") throw new QueueError("Only a called patient can be recalled", 409, "bad_state");
    const row = db.update(entries).set({ calledAt: now() }).where(eq(entries.id, entryId)).returning().get();
    afterChange(e.campId);
    return row;
  }

  function startServing(entryId: number): Entry {
    const e = mustEntry(entryId);
    if (e.status !== "called") throw new QueueError("Call the patient first", 409, "bad_state");
    const row = db.update(entries).set({ status: "serving", startedAt: now() }).where(eq(entries.id, entryId)).returning().get();
    afterChange(e.campId);
    return row;
  }

  /**
   * Finishes a patient at this station and sends them on.
   * `forwardTo` overrides the station's default next stop; pass null to end the journey.
   */
  function complete(entryId: number, opts: { forwardTo?: number | null } = {}): { finished: boolean; nextEntry: Entry | null } {
    const out = db.transaction(
      (tx) => {
        const e = mustEntry(entryId, tx);
        if (e.status !== "called" && e.status !== "serving") throw new QueueError("Nothing to complete", 409, "bad_state");
        const t = now();
        tx.update(entries)
          .set({ status: "done", endedAt: t, startedAt: e.startedAt ?? e.calledAt ?? t })
          .where(eq(entries.id, entryId))
          .run();
        const station = getStation(e.stationId, tx)!;
        const destId = opts.forwardTo === undefined ? station.nextStationId : opts.forwardTo;
        const dest = destId ? getStation(destId, tx) : undefined;
        if (destId && (!dest || dest.campId !== e.campId)) throw new QueueError("Unknown next station", 400, "bad_station");
        if (!dest) {
          tx.update(tokens).set({ status: "completed" }).where(eq(tokens.id, e.tokenId)).run();
          return { campId: e.campId, finished: true, nextEntry: null };
        }
        const nextEntry = tx
          .insert(entries)
          .values({
            tokenId: e.tokenId,
            stationId: dest.id,
            campId: e.campId,
            status: "waiting",
            priorityRank: e.priorityRank,
            queuedAt: t,
            createdAt: t,
          })
          .returning()
          .get();
        return { campId: e.campId, finished: false, nextEntry };
      },
      { behavior: "immediate" },
    );
    afterChange(out.campId);
    return { finished: out.finished, nextEntry: out.nextEntry };
  }

  /** Patient did not turn up. By default they get one more place at the back of the line. */
  function markNoShow(entryId: number, opts: { requeue?: boolean } = {}): { requeued: boolean } {
    const out = db.transaction(
      (tx) => {
        const e = mustEntry(entryId, tx);
        if (e.status !== "called") throw new QueueError("Only a called patient can be skipped", 409, "bad_state");
        const t = now();
        tx.update(entries).set({ status: "no_show", endedAt: t }).where(eq(entries.id, entryId)).run();
        const previous = tx
          .select({ n: sql<number>`count(*)` })
          .from(entries)
          .where(and(eq(entries.tokenId, e.tokenId), eq(entries.stationId, e.stationId), eq(entries.status, "no_show")))
          .get();
        const canRequeue = (opts.requeue ?? true) && (previous?.n ?? 0) <= 1;
        if (canRequeue) {
          tx.insert(entries)
            .values({
              tokenId: e.tokenId,
              stationId: e.stationId,
              campId: e.campId,
              status: "waiting",
              priorityRank: e.priorityRank,
              queuedAt: t,
              createdAt: t,
            })
            .run();
        } else {
          tx.update(tokens).set({ status: "cancelled" }).where(eq(tokens.id, e.tokenId)).run();
        }
        return { campId: e.campId, requeued: canRequeue };
      },
      { behavior: "immediate" },
    );
    afterChange(out.campId);
    return { requeued: out.requeued };
  }

  function setPaused(stationId: number, paused: boolean): Station {
    return updateStation(stationId, { isPaused: paused });
  }

  /** Staff look a patient up by printed label, e.g. "GEN-042". */
  function findTokenByLabel(campId: number, label: string): Token | undefined {
    return db
      .select()
      .from(tokens)
      .where(and(eq(tokens.campId, campId), eq(tokens.label, label.trim().toUpperCase())))
      .get();
  }

  const findTokenByPublicId = (publicId: string) => db.select().from(tokens).where(eq(tokens.publicId, publicId)).get();

  // ---------- read models ----------

  function getCampSnapshot(campId: number): CampSnapshot {
    const camp = getCamp(campId);
    if (!camp) throw new QueueError("Camp not found", 404, "not_found");
    const rows = listStations(campId).map((s): StationSnapshot => {
      const waiting = waitingAt(s.id);
      const active = activeAt(s.id);
      const avg = avgServiceSeconds(s);
      const labelOf = (tokenId: number) => db.select({ l: tokens.label }).from(tokens).where(eq(tokens.id, tokenId)).get()?.l ?? "";
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        color: s.color,
        counters: s.counters,
        isPaused: s.isPaused,
        acceptsRegistration: s.acceptsRegistration,
        waiting: waiting.length,
        avgServiceSeconds: Math.round(avg),
        newArrivalWaitSeconds: estimateWaitSeconds({
          ahead: waiting.length,
          counters: s.counters,
          busyCounters: active.length,
          avgServiceSeconds: avg,
        }),
        active: active
          .sort((a, b) => (a.counter ?? 0) - (b.counter ?? 0))
          .map((e) => ({ label: labelOf(e.tokenId), counter: e.counter, status: e.status as "called" | "serving", calledAt: e.calledAt ?? 0 })),
        upNext: waiting.slice(0, 3).map((e) => labelOf(e.tokenId)),
      };
    });
    const { id, slug, name, venue, graceMinutes, opensAt, closesAt, slotMinutes, slotCapacity } = camp;
    return { camp: { id, slug, name, venue, graceMinutes, opensAt, closesAt, slotMinutes, slotCapacity }, stations: rows, updatedAt: now() };
  }

  function getTokenStatus(publicId: string): TokenStatus | null {
    const token = findTokenByPublicId(publicId);
    if (!token) return null;
    const camp = getCamp(token.campId)!;
    const all = db.select().from(entries).where(eq(entries.tokenId, token.id)).orderBy(asc(entries.id)).all();
    const current = all[all.length - 1];
    const station = getStation(current.stationId)!;
    const active = activeAt(station.id);

    let position: number | null = null;
    let ahead: number | null = null;
    let etaSeconds: number | null = null;
    if (current.status === "waiting") {
      const waiting = waitingAt(station.id);
      const idx = waiting.findIndex((w) => w.id === current.id);
      position = idx + 1;
      ahead = idx;
      etaSeconds = estimateWaitSeconds({
        ahead: idx,
        counters: station.counters,
        busyCounters: active.length,
        avgServiceSeconds: avgServiceSeconds(station),
      });
    }
    const labels = active.map((e) => db.select({ l: tokens.label }).from(tokens).where(eq(tokens.id, e.tokenId)).get()?.l ?? "");
    const next = station.nextStationId ? getStation(station.nextStationId) : undefined;
    const names = new Map(listStations(token.campId).map((s) => [s.id, s.name]));

    return {
      token: {
        publicId: token.publicId,
        label: token.label,
        name: token.name,
        priorityReason: token.priorityReason,
        status: token.status,
        scheduledFor: token.scheduledFor,
        language: token.language,
      },
      camp: { slug: camp.slug, name: camp.name, venue: camp.venue, graceMinutes: camp.graceMinutes },
      stage: {
        entryId: current.id,
        status: current.status,
        stationId: station.id,
        stationName: station.name,
        stationColor: station.color,
        counter: current.counter,
        calledAt: current.calledAt,
        position,
        ahead,
        etaSeconds,
        nowServing: labels,
        nextStationName: next?.name ?? null,
      },
      journey: all.map((e) => ({ stationName: names.get(e.stationId) ?? "", status: e.status })),
      updatedAt: now(),
    };
  }

  /** What staff at one station see: everyone waiting plus who is with a doctor now. */
  function getStationQueue(stationId: number): { station: Station; avgServiceSeconds: number; active: QueueRow[]; waiting: QueueRow[] } {
    const station = getStation(stationId);
    if (!station) throw new QueueError("Station not found", 404, "not_found");
    const toRow = (e: Entry): QueueRow => {
      const t = db.select().from(tokens).where(eq(tokens.id, e.tokenId)).get()!;
      return {
        entryId: e.id,
        label: t.label,
        name: t.name,
        age: t.age,
        priorityReason: t.priorityReason,
        hasPhone: !!t.phone,
        status: e.status,
        counter: e.counter,
        queuedAt: e.queuedAt,
        calledAt: e.calledAt,
        startedAt: e.startedAt,
      };
    };
    return {
      station,
      avgServiceSeconds: Math.round(avgServiceSeconds(station)),
      active: activeAt(stationId).sort((a, b) => (a.counter ?? 0) - (b.counter ?? 0)).map(toRow),
      waiting: waitingAt(stationId).map(toRow),
    };
  }

  // ---------- analytics ----------

  function analytics(campId: number) {
    const camp = getCamp(campId);
    if (!camp) throw new QueueError("Camp not found", 404, "not_found");
    const st = listStations(campId);
    const allTokens = db.select().from(tokens).where(eq(tokens.campId, campId)).all();
    const allEntries = db.select().from(entries).where(eq(entries.campId, campId)).all();
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const waits = (list: Entry[]) => list.filter((e) => e.calledAt).map((e) => Math.max(0, (e.calledAt! - e.queuedAt) / 1000));
    const services = (list: Entry[]) =>
      list.filter((e) => e.status === "done" && e.startedAt && e.endedAt).map((e) => (e.endedAt! - e.startedAt!) / 1000);

    const perStation = st.map((s) => {
      const mine = allEntries.filter((e) => e.stationId === s.id);
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        served: mine.filter((e) => e.status === "done").length,
        waiting: mine.filter((e) => e.status === "waiting").length,
        noShows: mine.filter((e) => e.status === "no_show").length,
        avgWaitSeconds: Math.round(avg(waits(mine))),
        avgServiceSeconds: Math.round(avg(services(mine))),
      };
    });

    const byHour = new Map<number, number>();
    for (const t of allTokens) {
      const h = new Date(t.createdAt).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    const arrivalsByHour = [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([hour, count]) => ({ hour, count }));

    return {
      totals: {
        registered: allTokens.length,
        active: allTokens.filter((t) => t.status === "active").length,
        completed: allTokens.filter((t) => t.status === "completed").length,
        cancelled: allTokens.filter((t) => t.status === "cancelled").length,
        noShowEvents: allEntries.filter((e) => e.status === "no_show").length,
        priorityShare: allTokens.length ? allTokens.filter((t) => t.priorityReason !== "none").length / allTokens.length : 0,
        avgWaitSeconds: Math.round(avg(waits(allEntries))),
        avgServiceSeconds: Math.round(avg(services(allEntries))),
      },
      perStation,
      arrivalsByHour,
    };
  }

  function exportCsv(campId: number): string {
    const st = new Map(listStations(campId).map((s) => [s.id, s.name]));
    const tk = new Map(db.select().from(tokens).where(eq(tokens.campId, campId)).all().map((t) => [t.id, t]));
    const rows = db.select().from(entries).where(eq(entries.campId, campId)).orderBy(asc(entries.id)).all();
    const iso = (n: number | null) => (n ? new Date(n).toISOString() : "");
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["token", "age", "priority", "station", "status", "queued_at", "called_at", "started_at", "ended_at", "wait_seconds", "service_seconds"];
    const lines = rows.map((e) => {
      const t = tk.get(e.tokenId)!;
      const wait = e.calledAt ? Math.round((e.calledAt - e.queuedAt) / 1000) : "";
      const svc = e.startedAt && e.endedAt ? Math.round((e.endedAt - e.startedAt) / 1000) : "";
      return [t.label, t.age, t.priorityReason, st.get(e.stationId) ?? "", e.status, iso(e.queuedAt), iso(e.calledAt), iso(e.startedAt), iso(e.endedAt), wait, svc]
        .map(esc)
        .join(",");
    });
    return [head.join(","), ...lines].join("\n");
  }

  /** Removes names and phone numbers after a camp ends. Queue statistics stay. */
  function anonymiseCamp(campId: number): number {
    const res = db.update(tokens).set({ name: "Anonymised", phone: null }).where(eq(tokens.campId, campId)).run();
    afterChange(campId);
    return res.changes;
  }

  // ---------- notifications ----------

  function sms(token: Token, key: "smsAlmost" | "smsNext" | "smsCalled", vars: Record<string, string | number>) {
    if (!deps.notifier || !token.phone) return;
    const lang = isLang(token.language) ? token.language : "en";
    const body = fill(dictionaries[lang][key], { label: token.label, ...vars });
    deps.notifier.send(token.phone, body).catch((err) => console.error("[sms] failed", err));
  }

  function sendCalledSms(token: Token, station: Station, counter: number | null) {
    sms(token, "smsCalled", { station: station.name, counter: counter ?? "" });
  }

  /** Texts patients who have just come within `notifyAhead` places. Each patient is texted once per stop. */
  function notifyUpcoming(campId: number) {
    if (!deps.notifier) return;
    const camp = getCamp(campId);
    if (!camp) return;
    for (const s of listStations(campId)) {
      const waiting = waitingAt(s.id).slice(0, camp.notifyAhead + 1);
      waiting.forEach((e, ahead) => {
        if (e.notifiedAt) return;
        const claimed = db
          .update(entries)
          .set({ notifiedAt: now() })
          .where(and(eq(entries.id, e.id), sql`${entries.notifiedAt} is null`))
          .run();
        if (claimed.changes === 0) return;
        const token = db.select().from(tokens).where(eq(tokens.id, e.tokenId)).get();
        if (token) sms(token, ahead === 0 ? "smsNext" : "smsAlmost", { ahead, station: s.name, url: `${baseUrl}/t/${token.publicId}` });
      });
    }
  }

  function afterChange(campId: number) {
    notifyUpcoming(campId);
    emit(campId);
  }

  return {
    getCamp,
    getCampBySlug,
    listCamps,
    listStations,
    getStation,
    createCamp,
    addStation,
    updateStation,
    setPaused,
    register,
    countBookedInSlot: (campId: number, slotStart: number) => countBookedInSlot(campId, slotStart),
    checkIn,
    cancelToken,
    callNext,
    recall,
    startServing,
    complete,
    markNoShow,
    findTokenByLabel,
    findTokenByPublicId,
    getCampSnapshot,
    getTokenStatus,
    getStationQueue,
    analytics,
    exportCsv,
    anonymiseCamp,
  };
}

export type QueueService = ReturnType<typeof createQueueService>;
