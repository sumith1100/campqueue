import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time like 09:30");

export const registerSchema = z.object({
  campSlug: z.string().min(1),
  stationId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, "Enter the full name").max(80),
  age: z.coerce.number().int().min(0, "Enter a valid age").max(120, "Enter a valid age"),
  phone: z.string().trim().max(20).optional(),
  language: z.enum(["en", "kn", "hi"]).default("en"),
  priority: z.enum(["none", "senior", "pregnant", "differently_abled", "emergency"]).default("none"),
  scheduledFor: z.number().int().positive().optional(),
  desk: z.boolean().optional(),
});

export const loginSchema = z.object({ pin: z.string().min(1).max(64) });

export const callSchema = z.object({ counter: z.coerce.number().int().min(1).max(20).default(1) });

export const completeSchema = z.object({
  forwardTo: z.number().int().positive().nullable().optional(),
});

export const noShowSchema = z.object({ requeue: z.boolean().optional() });

export const campSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "Use 3-40 lowercase letters, numbers or dashes")
    .optional(),
  venue: z.string().trim().max(120).default(""),
  opensAt: time.default("09:00"),
  closesAt: time.default("17:00"),
  slotMinutes: z.coerce.number().int().min(10).max(120).default(30),
  slotCapacity: z.coerce.number().int().min(1).max(500).default(10),
  notifyAhead: z.coerce.number().int().min(1).max(10).default(3),
  graceMinutes: z.coerce.number().int().min(1).max(30).default(5),
  preset: z.enum(["general", "blank"]).default("general"),
});

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0a6f72");

export const stationCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}$/, "Use 2-5 letters"),
  color: color.default("#0a6f72"),
  counters: z.coerce.number().int().min(1).max(20).default(1),
  defaultServiceSeconds: z.coerce.number().int().min(30).max(3600).default(300),
  nextStationId: z.number().int().positive().nullable().optional(),
  acceptsRegistration: z.boolean().default(true),
});

export const stationPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    color,
    counters: z.coerce.number().int().min(1).max(20),
    defaultServiceSeconds: z.coerce.number().int().min(30).max(3600),
    nextStationId: z.number().int().positive().nullable(),
    acceptsRegistration: z.boolean(),
    isPaused: z.boolean(),
  })
  .partial();

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "camp"
  );
}
