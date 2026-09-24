import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "@/lib/db";
import { createQueueService, QueueError, type QueueService } from "@/lib/queue/service";
import { createCampWithPreset } from "@/lib/queue/presets";
import type { Notifier } from "@/lib/notify";

let clock = 1_800_000_000_000;
const tick = (seconds: number) => (clock += seconds * 1000);

function setup() {
  clock = 1_800_000_000_000;
  const sent: { to: string; message: string }[] = [];
  const notifier: Notifier = { send: async (to, message) => void sent.push({ to, message }) };
  const emit = vi.fn();
  const svc = createQueueService({ db: openDatabase(":memory:"), now: () => clock, notifier, emit, baseUrl: "https://camp.test" });
  const camp = createCampWithPreset(svc, { slug: "demo", name: "Demo camp", slotCapacity: 2 }, "general");
  const byCode = (code: string) => svc.listStations(camp.id).find((s) => s.code === code)!;
  const reg = (over: Partial<Parameters<QueueService["register"]>[0]> & { code?: string } = {}) => {
    const { code = "GEN", ...rest } = over;
    return svc.register({ campId: camp.id, stationId: byCode(code).id, name: "Asha", age: 30, source: "self", ...rest });
  };
  return { svc, camp, byCode, reg, sent, emit };
}

describe("registration", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it("numbers tokens per station prefix", () => {
    const a = ctx.reg();
    const b = ctx.reg();
    const c = ctx.reg({ code: "EYE" });
    expect([a.token.label, b.token.label, c.token.label]).toEqual(["GEN-001", "GEN-002", "EYE-001"]);
  });

  it("blocks self-registration for referral-only stations but allows desk", () => {
    expect(() => ctx.reg({ code: "PHA" })).toThrow(QueueError);
    expect(ctx.reg({ code: "PHA", source: "desk" }).token.label).toBe("PHA-001");
  });

  it("auto-prioritises seniors and ignores self-declared emergencies", () => {
    expect(ctx.reg({ age: 72 }).token.priorityReason).toBe("senior");
    expect(ctx.reg({ priority: "emergency" }).token.priorityReason).toBe("none");
    expect(ctx.reg({ priority: "emergency", source: "desk" }).token.priorityReason).toBe("emergency");
  });

  it("rejects a station that belongs to another camp", () => {
    const other = createCampWithPreset(ctx.svc, { slug: "other", name: "Other" }, "general");
    const foreign = ctx.svc.listStations(other.id)[0];
    expect(() => ctx.svc.register({ campId: ctx.camp.id, stationId: foreign.id, name: "X", age: 20, source: "self" })).toThrow(/Unknown service/);
  });

  it("refuses new patients at a paused station unless desk staff register them", () => {
    ctx.svc.setPaused(ctx.byCode("GEN").id, true);
    expect(() => ctx.reg()).toThrow(/paused/);
    expect(ctx.reg({ source: "desk" }).token.label).toBe("GEN-001");
  });
});

describe("calling and ordering", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it("calls in arrival order, with priority jumping ahead", () => {
    const first = ctx.reg({ name: "First" });
    tick(10);
    const second = ctx.reg({ name: "Second" });
    tick(10);
    const senior = ctx.reg({ name: "Senior", age: 70 });
    tick(10);
    const emergency = ctx.reg({ name: "Emergency", priority: "emergency", source: "desk" });

    const gen = ctx.byCode("GEN");
    const order: string[] = [];
    for (let counter = 1; counter <= 2; counter++) order.push(ctx.svc.callNext(gen.id, counter)!.label);
    expect(order).toEqual([emergency.token.label, senior.token.label]);

    const c1 = ctx.svc.getStationQueue(gen.id).active[0];
    ctx.svc.complete(c1.entryId);
    expect(ctx.svc.callNext(gen.id, 1)!.label).toBe(first.token.label);
    void second;
  });

  it("returns null when nobody is waiting", () => {
    expect(ctx.svc.callNext(ctx.byCode("GEN").id, 1)).toBeNull();
  });

  it("will not call for a counter that is still busy", () => {
    ctx.reg();
    ctx.reg();
    const gen = ctx.byCode("GEN");
    ctx.svc.callNext(gen.id, 1);
    expect(() => ctx.svc.callNext(gen.id, 1)).toThrow(/Finish or skip/);
    expect(() => ctx.svc.callNext(gen.id, 3)).toThrow(/No such counter/);
  });

  it("never calls the same patient twice", () => {
    ctx.reg();
    const gen = ctx.byCode("GEN");
    const a = ctx.svc.callNext(gen.id, 1);
    const b = ctx.svc.callNext(gen.id, 2);
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });

  it("refuses to call from a paused station", () => {
    ctx.reg();
    const gen = ctx.byCode("GEN");
    ctx.svc.setPaused(gen.id, true);
    expect(() => ctx.svc.callNext(gen.id, 1)).toThrow(/paused/);
  });
});

describe("multi-station flow", () => {
  it("moves a patient SCR -> GEN -> PHA and completes the token", () => {
    const { svc, byCode, reg } = setup();
    const { token } = reg({ code: "SCR", age: 65 });

    const scr = byCode("SCR");
    const gen = byCode("GEN");
    const pha = byCode("PHA");

    const first = svc.callNext(scr.id, 1)!;
    svc.startServing(first.id);
    tick(120);
    const step1 = svc.complete(first.id);
    expect(step1.finished).toBe(false);
    expect(step1.nextEntry?.stationId).toBe(gen.id);
    expect(step1.nextEntry?.priorityRank).toBe(1); // senior status carries over

    const second = svc.callNext(gen.id, 1)!;
    tick(300);
    const step2 = svc.complete(second.id);
    expect(step2.nextEntry?.stationId).toBe(pha.id);

    const third = svc.callNext(pha.id, 1)!;
    const step3 = svc.complete(third.id);
    expect(step3.finished).toBe(true);
    expect(svc.getTokenStatus(token.publicId)?.token.status).toBe("completed");
    expect(svc.getTokenStatus(token.publicId)?.journey.map((j) => j.stationName)).toEqual([
      "BP and sugar screening",
      "General physician",
      "Pharmacy",
    ]);
  });

  it("lets staff override or end the journey", () => {
    const { svc, byCode, reg } = setup();
    reg({ code: "SCR" });
    const e = svc.callNext(byCode("SCR").id, 1)!;
    const done = svc.complete(e.id, { forwardTo: null });
    expect(done.finished).toBe(true);
  });

  it("rejects flows that loop", () => {
    const { svc, byCode } = setup();
    expect(() => svc.updateStation(byCode("PHA").id, { nextStationId: byCode("SCR").id })).toThrow(/loop/);
    expect(() => svc.updateStation(byCode("GEN").id, { nextStationId: byCode("GEN").id })).toThrow(QueueError);
  });
});

describe("no-shows", () => {
  it("requeues once at the back, then cancels on the second no-show", () => {
    const { svc, byCode, reg } = setup();
    const gen = byCode("GEN");
    const ghost = reg({ name: "Ghost" });
    tick(5);
    const other = reg({ name: "Other" });

    const c1 = svc.callNext(gen.id, 1)!;
    expect(svc.markNoShow(c1.id).requeued).toBe(true);
    // Other is now ahead of the requeued ghost
    expect(svc.getStationQueue(gen.id).waiting.map((w) => w.label)).toEqual([other.token.label, ghost.token.label]);

    svc.callNext(gen.id, 1); // other
    const cg = svc.callNext(gen.id, 2)!; // ghost again
    expect(cg.label).toBe(ghost.token.label);
    expect(svc.markNoShow(cg.id).requeued).toBe(false);
    expect(svc.getTokenStatus(ghost.token.publicId)?.token.status).toBe("cancelled");
  });

  it("only allows skipping a called patient", () => {
    const { svc, reg } = setup();
    const { entry } = reg();
    expect(() => svc.markNoShow(entry.id)).toThrow(/Only a called/);
  });
});

describe("live status and estimates", () => {
  it("reports position and a wait estimate that improves with real timings", () => {
    const { svc, byCode, reg } = setup();
    const gen = byCode("GEN"); // 2 counters, default 420s
    const tokens = Array.from({ length: 6 }, (_, i) => reg({ name: `P${i}` }).token);

    const before = svc.getTokenStatus(tokens[5].publicId)!;
    expect(before.stage.position).toBe(6);
    expect(before.stage.ahead).toBe(5);
    expect(before.stage.etaSeconds).toBe(Math.round((5 / 2) * 420));

    // Two quick consultations (60s each) pull the average down.
    for (let round = 0; round < 2; round++) {
      const a = svc.callNext(gen.id, 1)!;
      svc.startServing(a.id);
      tick(60);
      svc.complete(a.id, { forwardTo: null });
    }
    const after = svc.getTokenStatus(tokens[5].publicId)!;
    expect(after.stage.position).toBe(4);
    expect(after.stage.etaSeconds!).toBeLessThan(Math.round((3 / 2) * 420));
  });

  it("exposes who is being served without leaking names on the public snapshot", () => {
    const { svc, camp, byCode, reg } = setup();
    reg({ name: "Very Private Name" });
    svc.callNext(byCode("GEN").id, 2);
    const snap = svc.getCampSnapshot(camp.id);
    const gen = snap.stations.find((s) => s.code === "GEN")!;
    expect(gen.active).toEqual([expect.objectContaining({ label: "GEN-001", counter: 2, status: "called" })]);
    expect(JSON.stringify(snap)).not.toContain("Very Private Name");
  });

  it("returns null for an unknown token", () => {
    expect(setup().svc.getTokenStatus("nope")).toBeNull();
  });
});

describe("pre-booking", () => {
  it("enforces slot capacity", () => {
    const { svc, camp, reg } = setup();
    const slot = clock + 3_600_000;
    reg({ source: "booking", scheduledFor: slot });
    reg({ source: "booking", scheduledFor: slot });
    expect(() => reg({ source: "booking", scheduledFor: slot })).toThrow(/slot is full/);
    expect(svc.getCampSnapshot(camp.id).stations.find((s) => s.code === "GEN")!.waiting).toBe(0);
  });

  it("holds booked patients out of the live queue until check-in, ahead of later walk-ins", () => {
    const { svc, byCode, reg } = setup();
    const slot = clock + 1_800_000; // in 30 minutes
    const booked = reg({ name: "Booked", source: "booking", scheduledFor: slot });
    expect(booked.entry.status).toBe("booked");
    expect(svc.callNext(byCode("GEN").id, 1)).toBeNull();

    tick(35 * 60); // slot has started; a walk-in arrives after it
    const walkIn = reg({ name: "Walk-in" });
    svc.checkIn(booked.token.id);
    expect(svc.getStationQueue(byCode("GEN").id).waiting.map((w) => w.label)).toEqual([
      booked.token.label,
      walkIn.token.label,
    ]);
  });

  it("orders an early arrival by arrival time, not slot time", () => {
    const { svc, byCode, reg } = setup();
    const booked = reg({ name: "Early", source: "booking", scheduledFor: clock + 3_600_000 });
    tick(10);
    const walkIn = reg({ name: "Walk-in" });
    tick(10);
    svc.checkIn(booked.token.id);
    expect(svc.getStationQueue(byCode("GEN").id).waiting.map((w) => w.label)).toEqual([walkIn.token.label, booked.token.label]);
  });

  it("does not check in twice", () => {
    const { svc, reg } = setup();
    const b = reg({ source: "booking", scheduledFor: clock + 600_000 });
    svc.checkIn(b.token.id);
    expect(() => svc.checkIn(b.token.id)).toThrow(/not waiting for check-in/);
  });
});

describe("cancelling", () => {
  it("cancels a waiting token but not one already called", () => {
    const { svc, byCode, reg } = setup();
    const a = reg();
    const b = reg();
    svc.cancelToken(a.token.id);
    expect(svc.getStationQueue(byCode("GEN").id).waiting.map((w) => w.label)).toEqual([b.token.label]);
    svc.callNext(byCode("GEN").id, 1);
    expect(() => svc.cancelToken(b.token.id)).toThrow(/no longer be cancelled/);
  });
});

describe("notifications", () => {
  it("texts a patient once when they get close, in their language, and again when called", () => {
    const { svc, byCode, reg, sent } = setup();
    const gen = byCode("GEN");
    for (let i = 0; i < 6; i++) reg({ name: `P${i}` });
    const kn = reg({ name: "Kannada", phone: "+919845012345", language: "kn" });
    expect(sent).toHaveLength(0); // 6 people ahead, notifyAhead is 3

    for (let i = 0; i < 3; i++) {
      const e = svc.callNext(gen.id, 1)!;
      svc.complete(e.id, { forwardTo: null });
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("+919845012345");
    expect(sent[0].message).toContain(kn.token.label);
    expect(sent[0].message).toContain("ಜನರಿದ್ದಾರೆ");
    expect(sent[0].message).toContain(`https://camp.test/t/${kn.token.publicId}`);

    // more movement does not repeat the heads-up
    const e = svc.callNext(gen.id, 1)!;
    svc.complete(e.id, { forwardTo: null });
    expect(sent.filter((s) => s.message.includes("ಜನರಿದ್ದಾರೆ"))).toHaveLength(1);

    // two patients ahead are called and finished, then the Kannada-speaking patient is called
    for (let i = 0; i < 2; i++) {
      const ahead = svc.callNext(gen.id, 1)!;
      svc.complete(ahead.id, { forwardTo: null });
    }
    expect(sent.some((s) => s.message.includes("ಈಗ ನಿಮ್ಮ ಸರದಿ"))).toBe(false);
    svc.callNext(gen.id, 1);
    expect(sent.some((s) => s.message.includes("ಈಗ ನಿಮ್ಮ ಸರದಿ"))).toBe(true);
  });

  it("does not text people without a phone number", () => {
    const { reg, sent } = setup();
    reg();
    expect(sent).toHaveLength(0);
  });
});

describe("analytics and privacy", () => {
  it("summarises the day and exports CSV without phone numbers", () => {
    const { svc, camp, byCode, reg } = setup();
    reg({ name: "Asha", phone: "+919845012345" });
    tick(60);
    const e = svc.callNext(byCode("GEN").id, 1)!;
    svc.startServing(e.id);
    tick(200);
    svc.complete(e.id, { forwardTo: null });

    const a = svc.analytics(camp.id);
    expect(a.totals).toMatchObject({ registered: 1, completed: 1, avgWaitSeconds: 60, avgServiceSeconds: 200 });
    expect(a.perStation.find((s) => s.name === "General physician")).toMatchObject({ served: 1, avgWaitSeconds: 60 });

    const csv = svc.exportCsv(camp.id);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).not.toContain("919845012345");
    expect(csv).not.toContain("Asha");
  });

  it("anonymises personal data after the camp", () => {
    const { svc, camp, reg } = setup();
    const { token } = reg({ name: "Asha", phone: "+919845012345" });
    expect(svc.anonymiseCamp(camp.id)).toBe(1);
    const status = svc.getTokenStatus(token.publicId)!;
    expect(status.token.name).toBe("Anonymised");
  });
});
