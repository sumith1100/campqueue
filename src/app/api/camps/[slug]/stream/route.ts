import { fail, handle, sse } from "@/lib/http";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const q = getQueue();
    const camp = q.getCampBySlug(slug);
    if (!camp) return fail("Camp not found", 404, "not_found");
    return sse(req, camp.id, () => q.getCampSnapshot(camp.id));
  });
}
