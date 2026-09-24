// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampSnapshot, TokenStatus } from "@/lib/queue/service";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push, refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners: Record<string, (e: MessageEvent) => void> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners[type] = fn;
  }
  emit(data: unknown) {
    this.listeners.update?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  close() {}
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const status = (over: Partial<TokenStatus["stage"]> = {}, token: Partial<TokenStatus["token"]> = {}): TokenStatus => ({
  token: { publicId: "abc12345", label: "GEN-007", name: "Asha", priorityReason: "none", status: "active", scheduledFor: null, language: "en", ...token },
  camp: { slug: "demo", name: "Demo Camp", venue: "Hall", graceMinutes: 5 },
  stage: {
    entryId: 1,
    status: "waiting",
    stationId: 2,
    stationName: "General physician",
    stationColor: "#0a6f72",
    counter: null,
    calledAt: null,
    position: 4,
    ahead: 3,
    etaSeconds: 780,
    nowServing: ["GEN-003"],
    nextStationName: "Pharmacy",
    ...over,
  },
  journey: [{ stationName: "General physician", status: "waiting" }],
  updatedAt: Date.now(),
});

describe("TokenTracker", () => {
  it("shows place in line and estimated wait", async () => {
    const { TokenTracker } = await import("@/components/token-tracker");
    render(<TokenTracker initial={status()} />);
    expect(screen.getByText("GEN-007")).toBeTruthy();
    expect(screen.getByText("Your place in line")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("13 min")).toBeTruthy();
    expect(screen.getByText("GEN-003")).toBeTruthy();
  });

  it("switches to Kannada", async () => {
    const { TokenTracker } = await import("@/components/token-tracker");
    render(<TokenTracker initial={status()} />);
    fireEvent.click(screen.getByRole("button", { name: "ಕನ್ನಡ" }));
    expect(screen.getByText("ಸರದಿಯಲ್ಲಿ ನಿಮ್ಮ ಸ್ಥಾನ")).toBeTruthy();
  });

  it("updates live when the server pushes a called state and buzzes the phone", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const { TokenTracker } = await import("@/components/token-tracker");
    render(<TokenTracker initial={status()} />);
    const es = FakeEventSource.instances[0];
    expect(es.url).toBe("/api/tokens/abc12345/stream");
    es.emit(status({ status: "called", counter: 2, calledAt: Date.now(), position: null, ahead: null, etaSeconds: null }));
    await waitFor(() => expect(screen.getByText("It is your turn")).toBeTruthy());
    expect(vibrate).toHaveBeenCalled();
    expect(document.title).toContain("It is your turn");
  });

  it("offers check-in for a booked patient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { TokenTracker } = await import("@/components/token-tracker");
    render(<TokenTracker initial={status({ status: "booked", position: null, ahead: null, etaSeconds: null }, { scheduledFor: Date.now() + 3600_000 })} />);
    fireEvent.click(screen.getByRole("button", { name: "I have arrived" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/tokens/abc12345/checkin", expect.objectContaining({ method: "POST" })));
  });

  it("asks before cancelling", async () => {
    const { TokenTracker } = await import("@/components/token-tracker");
    render(<TokenTracker initial={status()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel my token" }));
    expect(screen.getByRole("button", { name: "Keep my token" })).toBeTruthy();
  });
});

describe("RegisterForm", () => {
  const stations = [
    { id: 2, name: "General physician", code: "GEN", color: "#0a6f72", waiting: 3, waitMinutes: 10, isPaused: false },
    { id: 4, name: "Eye check-up", code: "EYE", color: "#5a3ea3", waiting: 0, waitMinutes: 1, isPaused: false },
  ];

  it("submits and sends the patient to their token page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ label: "GEN-008", url: "/t/xyz" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { RegisterForm } = await import("@/components/register-form");
    const { container } = render(<RegisterForm campSlug="demo" stations={stations} slots={[]} />);
    fireEvent.change(container.querySelector("input[name=name]")!, { target: { value: "Asha Rao" } });
    fireEvent.change(container.querySelector("input[name=age]")!, { target: { value: "64" } });
    fireEvent.click(screen.getByRole("button", { name: "Get token" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/t/xyz"));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ campSlug: "demo", stationId: 2, name: "Asha Rao", age: 64, language: "en", priority: "none" });
  });

  it("shows server errors in the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Enter the full name" }), { status: 422 })));
    const { RegisterForm } = await import("@/components/register-form");
    const { container } = render(<RegisterForm campSlug="demo" stations={stations} slots={[]} />);
    fireEvent.change(container.querySelector("input[name=name]")!, { target: { value: "A" } });
    fireEvent.change(container.querySelector("input[name=age]")!, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Get token" }));
    await waitFor(() => expect(screen.getByText("Enter the full name")).toBeTruthy());
  });

  it("only offers the emergency option to desk volunteers", async () => {
    const { RegisterForm } = await import("@/components/register-form");
    const first = render(<RegisterForm campSlug="demo" stations={stations} slots={[]} />);
    expect(screen.queryByText("Emergency")).toBeNull();
    first.unmount();
    render(<RegisterForm desk campSlug="demo" stations={stations} slots={[]} />);
    expect(screen.getByText("Emergency")).toBeTruthy();
  });

  it("lets a visitor book a slot and marks full slots unavailable", async () => {
    const { RegisterForm } = await import("@/components/register-form");
    render(
      <RegisterForm
        campSlug="demo"
        stations={stations}
        slots={[
          { start: 1, label: "10:00 – 10:30", left: 3 },
          { start: 2, label: "10:30 – 11:00", left: 0 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a time slot" }));
    expect((screen.getByRole("button", { name: /10:30 – 11:00/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /10:00 – 10:30/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});

const snapshot = (): CampSnapshot => ({
  camp: { id: 1, slug: "demo", name: "Demo Camp", venue: "Hall", graceMinutes: 5, opensAt: "09:00", closesAt: "17:00", slotMinutes: 30, slotCapacity: 10 },
  stations: [
    { id: 2, name: "General physician", code: "GEN", color: "#0a6f72", counters: 2, isPaused: false, acceptsRegistration: true, waiting: 3, avgServiceSeconds: 400, newArrivalWaitSeconds: 600, active: [{ label: "GEN-004", counter: 1, status: "called", calledAt: 100 }], upNext: ["GEN-005", "GEN-006"] },
    { id: 3, name: "Pharmacy", code: "PHA", color: "#2e6a38", counters: 1, isPaused: true, acceptsRegistration: false, waiting: 0, avgServiceSeconds: 90, newArrivalWaitSeconds: 0, active: [], upNext: [] },
  ],
  updatedAt: 1,
});

describe("DisplayBoard", () => {
  it("shows who is being called at each station", async () => {
    const { DisplayBoard } = await import("@/components/display-board");
    render(<DisplayBoard initial={snapshot()} />);
    expect(screen.getByText("GEN-004")).toBeTruthy();
    expect(screen.getByText("Counter 1")).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.getByText("No one waiting")).toBeTruthy();
  });

  it("announces a newly called token once voice is on, but not what was already on screen", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} lang = ""; rate = 1; });
    const { DisplayBoard } = await import("@/components/display-board");
    render(<DisplayBoard initial={snapshot()} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on voice" }));
    speak.mockClear();
    expect(speak).not.toHaveBeenCalled();

    const next = snapshot();
    next.stations[0].active = [{ label: "GEN-005", counter: 2, status: "called", calledAt: 200 }];
    FakeEventSource.instances[0].emit(next);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak.mock.calls[0][0].text).toBe("Token G E N 0 0 5, please go to General physician, counter 2.");

    FakeEventSource.instances[0].emit(next); // same call again: no repeat
    await new Promise((r) => setTimeout(r, 20));
    expect(speak).toHaveBeenCalledTimes(1);
  });
});

describe("StaffConsole", () => {
  const row = (over = {}) => ({ entryId: 9, label: "GEN-004", name: "Ravi", age: 41, priorityReason: "none", hasPhone: false, status: "waiting", counter: null, queuedAt: Date.now() - 120000, calledAt: null, startedAt: null, ...over });
  const queue = (over = {}) => ({ station: { id: 2 }, avgServiceSeconds: 300, active: [], waiting: [row(), row({ entryId: 10, label: "GEN-005", name: "Lakshmi", age: 70, priorityReason: "senior" })], ...over });

  it("calls the next patient", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/queue")) return new Response(JSON.stringify(queue()));
      return new Response(JSON.stringify({ called: { entryId: 9, label: "GEN-004" } }));
    }));
    const { StaffConsole } = await import("@/components/staff-console");
    render(
      <StaffConsole
        camp={{ slug: "demo", name: "Demo Camp", graceMinutes: 5 }}
        stations={[{ id: 2, name: "General physician", color: "#0a6f72", counters: 2, nextStationId: 3 }, { id: 3, name: "Pharmacy", color: "#2e6a38", counters: 1, nextStationId: null }]}
        initial={snapshot()}
      />,
    );
    await waitFor(() => expect(screen.getAllByText("GEN-004").length).toBeGreaterThan(0));
    expect(screen.getByText("Senior")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Call next" }));
    await waitFor(() => expect(calls).toContain("POST /api/staff/stations/2/call"));
  });

  it("shows the current patient with done, recall and skip controls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(queue({ active: [row({ status: "called", counter: 1, calledAt: Date.now() - 30000 })], waiting: [] })))));
    const { StaffConsole } = await import("@/components/staff-console");
    render(
      <StaffConsole
        camp={{ slug: "demo", name: "Demo Camp", graceMinutes: 5 }}
        stations={[{ id: 2, name: "General physician", color: "#0a6f72", counters: 2, nextStationId: 3 }, { id: 3, name: "Pharmacy", color: "#2e6a38", counters: 1, nextStationId: null }]}
        initial={snapshot()}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Patient is here" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Call again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done with GEN-004" })).toBeTruthy();
    expect(screen.getByText(/Pharmacy \(usual next stop\)/)).toBeTruthy();
  });
});
