import { handle, json, parseId, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { callSchema } from "@/lib/validators";

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await requireRole("staff");
    if (denied) return denied;
    const { id } = await ctx.params;
    const { counter } = callSchema.parse(await readJson(req));
    const called = getQueue().callNext(parseId(id), counter);
    return json({ called: called ? { entryId: called.id, label: called.label } : null });
  });
}
