import { fail, handle, json, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";

export function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const denied = await requireRole("admin");
    if (denied) return denied;
    const { slug } = await ctx.params;
    const q = getQueue();
    const camp = q.getCampBySlug(slug);
    if (!camp) return fail("Camp not found", 404, "not_found");
    return json({ anonymised: q.anonymiseCamp(camp.id) });
  });
}
