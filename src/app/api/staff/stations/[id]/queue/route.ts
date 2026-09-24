import { handle, json, parseId, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await requireRole("staff");
    if (denied) return denied;
    const { id } = await ctx.params;
    return json(getQueue().getStationQueue(parseId(id)));
  });
}
