import { handle, json, parseId, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { z } from "zod";

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await requireRole("staff");
    if (denied) return denied;
    const { id } = await ctx.params;
    const { paused } = z.object({ paused: z.boolean() }).parse(await readJson(req));
    return json(getQueue().setPaused(parseId(id), paused));
  });
}
