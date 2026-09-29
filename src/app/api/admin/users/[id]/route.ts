import { handle, json, readJson, requireRole } from "@/lib/http";
import { setUserActive } from "@/lib/users";
import { userStatusSchema } from "@/lib/validators";

export function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await requireRole("admin");
    if (denied) return denied;
    const { id } = await context.params;
    if (!setUserActive(id, userStatusSchema.parse(await readJson(req)).active)) return json({ error: "Staff member not found", code: "not_found" }, 404);
    return json({ ok: true });
  });
}
