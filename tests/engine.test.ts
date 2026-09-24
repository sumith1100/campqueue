import { describe, expect, it } from "vitest";
import {
  compareEntries,
  estimateServiceSeconds,
  estimateWaitSeconds,
  formatLabel,
  normalisePhone,
  positionOf,
  priorityRank,
  resolvePriority,
  slotsForDay,
  sortQueue,
} from "@/lib/queue/engine";

describe("priority", () => {
  it("ranks emergency first, then special groups, then everyone", () => {
    expect(priorityRank("emergency")).toBe(0);
    expect(priorityRank("senior")).toBe(1);
    expect(priorityRank("pregnant")).toBe(1);
    expect(priorityRank("differently_abled")).toBe(1);
    expect(priorityRank("none")).toBe(2);
  });

  it("treats anyone 60+ as a senior automatically", () => {
    expect(resolvePriority(59, "none", "self")).toBe("none");
    expect(resolvePriority(60, "none", "self")).toBe("senior");
  });

  it("only lets desk staff mark an emergency", () => {
    expect(resolvePriority(30, "emergency", "self")).toBe("none");
    expect(resolvePriority(30, "emergency", "booking")).toBe("none");
    expect(resolvePriority(30, "emergency", "desk")).toBe("emergency");
  });

  it("keeps a declared reason for younger patients", () => {
    expect(resolvePriority(28, "pregnant", "self")).toBe("pregnant");
  });
});

describe("ordering", () => {
  const e = (id: number, priorityRank: number, queuedAt: number) => ({ id, priorityRank, queuedAt });

  it("sorts by priority, then arrival time, then id", () => {
    const sorted = sortQueue([e(1, 2, 100), e(2, 1, 300), e(3, 2, 50), e(4, 0, 900), e(5, 2, 50)]);
    expect(sorted.map((x) => x.id)).toEqual([4, 2, 3, 5, 1]);
  });

  it("does not mutate the input", () => {
    const input = [e(1, 2, 2), e(2, 2, 1)];
    sortQueue(input);
    expect(input.map((x) => x.id)).toEqual([1, 2]);
  });

  it("finds a 1-based position", () => {
    const waiting = [e(1, 2, 10), e(2, 2, 20), e(3, 1, 30)];
    expect(positionOf(waiting, 3)).toBe(1);
    expect(positionOf(waiting, 1)).toBe(2);
    expect(positionOf(waiting, 99)).toBeNull();
  });

  it("compareEntries is antisymmetric", () => {
    const a = e(1, 2, 10);
    const b = e(2, 2, 10);
    expect(Math.sign(compareEntries(a, b))).toBe(-Math.sign(compareEntries(b, a)));
  });
});

describe("service time estimate", () => {
  it("uses the default when there are no samples", () => {
    expect(estimateServiceSeconds(300, [])).toBe(300);
  });

  it("moves toward real measurements as samples arrive", () => {
    const few = estimateServiceSeconds(300, [100]);
    const many = estimateServiceSeconds(300, Array(30).fill(100));
    expect(few).toBeGreaterThan(many);
    expect(many).toBeLessThan(150);
    expect(few).toBeLessThan(300);
  });

  it("only uses the most recent window", () => {
    const samples = [...Array(50).fill(1000), ...Array(20).fill(60)];
    expect(estimateServiceSeconds(300, samples, { window: 20 })).toBeCloseTo((300 * 3 + 60 * 20) / 23, 5);
  });

  it("ignores junk samples", () => {
    expect(estimateServiceSeconds(300, [NaN, -5, 0])).toBe(300);
  });
});

describe("wait estimate", () => {
  it("scales with people ahead", () => {
    const base = { counters: 1, busyCounters: 0, avgServiceSeconds: 300 };
    expect(estimateWaitSeconds({ ...base, ahead: 0 })).toBe(0);
    expect(estimateWaitSeconds({ ...base, ahead: 4 })).toBe(1200);
  });

  it("is faster with more counters", () => {
    const one = estimateWaitSeconds({ ahead: 6, counters: 1, busyCounters: 0, avgServiceSeconds: 300 });
    const three = estimateWaitSeconds({ ahead: 6, counters: 3, busyCounters: 0, avgServiceSeconds: 300 });
    expect(three).toBe(one / 3);
  });

  it("adds half a service when every counter is busy", () => {
    expect(estimateWaitSeconds({ ahead: 0, counters: 2, busyCounters: 2, avgServiceSeconds: 300 })).toBe(150);
  });
});

describe("labels, slots and phones", () => {
  it("pads token numbers", () => {
    expect(formatLabel("gen", 7)).toBe("GEN-007");
    expect(formatLabel("EYE", 1234)).toBe("EYE-1234");
  });

  it("builds slots inside opening hours", () => {
    const slots = slotsForDay({ opensAt: "09:00", closesAt: "11:00", slotMinutes: 30 }, new Date(2026, 8, 21));
    expect(slots).toHaveLength(4);
    expect(slots[0].label).toBe("09:00 – 09:30");
    expect(slots[3].label).toBe("10:30 – 11:00");
  });

  it("normalises Indian mobile numbers", () => {
    expect(normalisePhone("98450 12345")).toBe("+919845012345");
    expect(normalisePhone("09845012345")).toBe("+919845012345");
    expect(normalisePhone("+91 98450-12345")).toBe("+919845012345");
    expect(normalisePhone("919845012345")).toBe("+919845012345");
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("5845012345")).toBeNull();
  });
});
