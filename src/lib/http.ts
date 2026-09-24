import { ZodError } from "zod";
import { hasRole, type Role } from "@/lib/auth";
import { QueueError } from "@/lib/queue/service";
import { subscribeCamp } from "@/lib/events";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const fail = (message: string, status = 400, code = "bad_request") => json({ error: message, code }, status);

/** Wraps a handler so thrown QueueErrors and validation errors become clean JSON responses. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof QueueError) return fail(err.message, err.status, err.code);
    if (err instanceof ZodError) return fail(err.issues[0]?.message ?? "Invalid input", 422, "invalid");
    console.error(err);
    return fail("Something went wrong on our side", 500, "server_error");
  }
}

export async function requireRole(role: Role): Promise<Response | null> {
  return (await hasRole(role)) ? null : fail("Please sign in", 401, "unauthorised");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export const parseId = (raw: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new QueueError("Invalid id", 400, "invalid_id");
  return n;
};

// ---- tiny in-memory rate limiter (per server process) ----
const hits = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return recent.length > limit;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Server-Sent Events: sends `produce()` now and again whenever the camp changes. */
export function sse(req: Request, campId: number, produce: () => unknown): Response {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const push = () => {
        try {
          controller.enqueue(enc.encode(`event: update\ndata: ${JSON.stringify(produce())}\n\n`));
        } catch {
          /* client went away or the data no longer exists */
        }
      };
      push();
      const unsubscribe = subscribeCamp(campId, push);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 20_000);
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
