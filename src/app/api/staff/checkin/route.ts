import { fail, handle, json, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { z } from "zod";

const schema = z.object({ campSlug: z.string(), label: z.string().min(3).max(12) });

export function POST(req: Request) {
  return handle(async () => {
    const denied = await requireRole("staff");
    if (denied) return denied;
    const { campSlug, label } = schema.parse(await readJson(req));
    const q = getQueue();
    const camp = q.getCampBySlug(campSlug);
    if (!camp) return fail("Camp not found", 404, "not_found");
    const token = q.findTokenByLabel(camp.id, label);
    if (!token) return fail(`No token ${label.toUpperCase()} in this camp`, 404, "not_found");
    q.checkIn(token.id);
    return json({ ok: true, label: token.label });
  });
}
