import { handle, json, parseId, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { stationPatchSchema } from "@/lib/validators";

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await requireRole("admin");
    if (denied) return denied;
    const { id } = await ctx.params;
    const patch = stationPatchSchema.parse(await readJson(req));
    return json(getQueue().updateStation(parseId(id), patch));
  });
}
