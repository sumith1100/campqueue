import { fail, handle, json } from "@/lib/http";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const q = getQueue();
    const camp = q.getCampBySlug(slug);
    return camp ? json(q.getCampSnapshot(camp.id)) : fail("Camp not found", 404, "not_found");
  });
}
