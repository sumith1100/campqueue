import { getDb } from "@/lib/db";
import { publishCampChange } from "@/lib/events";
import { getNotifier } from "@/lib/notify";
import { createQueueService, type QueueService } from "./service";

const g = globalThis as unknown as { __campqueueService?: QueueService };

/** Shared service wired to the real database, SMS provider and live-update bus. */
export function getQueue(): QueueService {
  if (!g.__campqueueService) {
    g.__campqueueService = createQueueService({
      db: getDb(),
      notifier: getNotifier(),
      emit: publishCampChange,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    });
  }
  return g.__campqueueService;
}
