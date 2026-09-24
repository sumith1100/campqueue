import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/** Opens (and migrates) a SQLite database. Pass ":memory:" in tests. */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return db;
}

const globalForDb = globalThis as unknown as { __campqueueDb?: Db };

/** One shared connection per server process (survives hot reloads in dev). */
export function getDb(): Db {
  if (!globalForDb.__campqueueDb) {
    globalForDb.__campqueueDb = openDatabase(process.env.DATABASE_PATH ?? "./data/campqueue.db");
  }
  return globalForDb.__campqueueDb;
}
