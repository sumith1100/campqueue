import { handle, json, readJson, requireRole } from "@/lib/http";
import { getQueue } from "@/lib/queue";
import { createCampWithPreset } from "@/lib/queue/presets";
import { campSchema, slugify } from "@/lib/validators";

export function POST(req: Request) {
  return handle(async () => {
    const denied = await requireRole("admin");
    if (denied) return denied;
    const { preset, slug, ...rest } = campSchema.parse(await readJson(req));
    const camp = createCampWithPreset(getQueue(), { ...rest, slug: slug ?? slugify(rest.name) }, preset);
    return json({ slug: camp.slug }, 201);
  });
}
