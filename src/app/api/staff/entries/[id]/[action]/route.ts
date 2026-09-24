import { fail, handle, json, parseId, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { completeSchema, noShowSchema } from "@/lib/validators";

export function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  return handle(async () => {
    const denied = await requireRole("staff");
    if (denied) return denied;
    const { id, action } = await ctx.params;
    const entryId = parseId(id);
    const q = getQueue();
    const body = await readJson(req);
    switch (action) {
      case "start":
        q.startServing(entryId);
        return json({ ok: true });
      case "recall":
        q.recall(entryId);
        return json({ ok: true });
      case "complete": {
        const { forwardTo } = completeSchema.parse(body);
        const r = q.complete(entryId, { forwardTo });
        return json({ finished: r.finished });
      }
      case "no-show": {
        const { requeue } = noShowSchema.parse(body);
        return json(q.markNoShow(entryId, { requeue }));
      }
      default:
        return fail("Unknown action", 404, "not_found");
    }
  });
}
