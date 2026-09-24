import { fail, handle, json } from "@/lib/http";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  return handle(async () => {
    const { publicId } = await ctx.params;
    const status = getQueue().getTokenStatus(publicId);
    return status ? json(status) : fail("Token not found", 404, "not_found");
  });
}
