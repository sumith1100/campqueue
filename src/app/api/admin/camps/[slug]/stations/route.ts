import { fail, handle, json, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { stationCreateSchema } from "@/lib/validators";

export function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const denied = await requireRole("admin");
    if (denied) return denied;
    const { slug } = await ctx.params;
    const q = getQueue();
    const camp = q.getCampBySlug(slug);
    if (!camp) return fail("Camp not found", 404, "not_found");
    const input = stationCreateSchema.parse(await readJson(req));
    return json(q.addStation({ campId: camp.id, ...input }), 201);
  });
}
