import { fail, handle, json } from "@/lib/http";
import { getQueue } from "@/lib/queue";

/** Patient actions from their own tracking page: check in on arrival, or cancel. */
export function POST(_req: Request, ctx: { params: Promise<{ publicId: string; action: string }> }) {
  return handle(async () => {
    const { publicId, action } = await ctx.params;
    const q = getQueue();
    const token = q.findTokenByPublicId(publicId);
    if (!token) return fail("Token not found", 404, "not_found");
    if (action === "checkin") q.checkIn(token.id);
    else if (action === "cancel") q.cancelToken(token.id);
    else return fail("Unknown action", 404, "not_found");
    return json({ ok: true });
  });
}
