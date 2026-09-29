import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const camps = sqliteTable("camps", {
  id: integer("id").primaryKey({ autoIncrement: true }), slug: text("slug").notNull().unique(), name: text("name").notNull(),
  venue: text("venue").notNull().default(""), notifyAhead: integer("notify_ahead").notNull().default(3),
  graceMinutes: integer("grace_minutes").notNull().default(5), opensAt: text("opens_at").notNull().default("09:00"),
  closesAt: text("closes_at").notNull().default("17:00"), slotMinutes: integer("slot_minutes").notNull().default(30),
  slotCapacity: integer("slot_capacity").notNull().default(10), createdAt: integer("created_at").notNull(),
});
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), name: text("name").notNull(), designation: text("designation").notNull(),
  role: text("role", { enum: ["staff", "volunteer"] }).notNull(), pinHash: text("pin_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: integer("created_at").notNull(),
}, (t) => [index("users_active_name").on(t.active, t.name)]);
export const stations = sqliteTable("stations", {
  id: integer("id").primaryKey({ autoIncrement: true }), campId: integer("camp_id").notNull().references(() => camps.id, { onDelete: "cascade" }),
  name: text("name").notNull(), code: text("code").notNull(), color: text("color").notNull().default("#0a6f72"),
  counters: integer("counters").notNull().default(1), defaultServiceSeconds: integer("default_service_seconds").notNull().default(300),
  nextStationId: integer("next_station_id"), acceptsRegistration: integer("accepts_registration", { mode: "boolean" }).notNull().default(true),
  isPaused: integer("is_paused", { mode: "boolean" }).notNull().default(false), sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [uniqueIndex("stations_camp_code").on(t.campId, t.code)]);
export const tokens = sqliteTable("tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }), campId: integer("camp_id").notNull().references(() => camps.id, { onDelete: "cascade" }),
  publicId: text("public_id").notNull().unique(), prefix: text("prefix").notNull(), number: integer("number").notNull(),
  label: text("label").notNull(), name: text("name").notNull(), age: integer("age").notNull(), phone: text("phone"),
  language: text("language").notNull().default("en"), priorityReason: text("priority_reason", { enum: ["none", "senior", "pregnant", "differently_abled", "emergency"] }).notNull().default("none"),
  source: text("source", { enum: ["self", "desk", "booking"] }).notNull(), scheduledFor: integer("scheduled_for"),
  status: text("status", { enum: ["active", "completed", "cancelled"] }).notNull().default("active"), createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("tokens_camp_label").on(t.campId, t.label)]);
export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }), tokenId: integer("token_id").notNull().references(() => tokens.id, { onDelete: "cascade" }),
  stationId: integer("station_id").notNull().references(() => stations.id, { onDelete: "cascade" }), campId: integer("camp_id").notNull(),
  status: text("status", { enum: ["booked", "waiting", "called", "serving", "done", "no_show", "cancelled"] }).notNull(),
  priorityRank: integer("priority_rank").notNull().default(2), queuedAt: integer("queued_at").notNull(), calledAt: integer("called_at"),
  startedAt: integer("started_at"), endedAt: integer("ended_at"), counter: integer("counter"), notifiedAt: integer("notified_at"), createdAt: integer("created_at").notNull(),
}, (t) => [index("entries_station_status").on(t.stationId, t.status), index("entries_token").on(t.tokenId), index("entries_camp").on(t.campId)]);
export type Camp = typeof camps.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = User["role"];
export type Station = typeof stations.$inferSelect;
export type Token = typeof tokens.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type PriorityReason = Token["priorityReason"];
export type EntryStatus = Entry["status"];
