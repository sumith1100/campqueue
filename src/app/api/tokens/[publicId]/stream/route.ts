import { fail, handle, sse } from "@/lib/http";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  return handle(async () => {
    const { publicId } = await ctx.params;
    const q = getQueue();
    const token = q.findTokenByPublicId(publicId);
    if (!token) return fail("Token not found", 404, "not_found");
    return sse(req, token.campId, () => q.getTokenStatus(publicId));
  });
}
