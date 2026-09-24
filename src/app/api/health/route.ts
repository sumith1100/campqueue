import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  getDb().run(sql`select 1`);
  return json({ ok: true });
}
