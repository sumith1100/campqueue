import { hasRole } from "@/lib/auth";
import { clientIp, fail, handle, json, rateLimited, readJson } from "@/lib/http";
import { normalisePhone, slotsForDay } from "@/lib/queue/engine";
import { getQueue } from "@/lib/queue";
import { registerSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const body = registerSchema.parse(await readJson(req));
    const q = getQueue();
    const camp = q.getCampBySlug(body.campSlug);
    if (!camp) return fail("We could not find this camp", 404, "not_found");

    const isStaff = body.desk === true && (await hasRole("staff"));
    // Volunteers register many people quickly, so only the public path is throttled.
    if (!isStaff && rateLimited(`register:${clientIp(req)}`, 12, 60_000))
      return fail("Too many registrations from this device. Please ask a volunteer.", 429, "rate_limited");

    let phone: string | null = null;
    if (body.phone) {
      phone = normalisePhone(body.phone, process.env.SMS_DEFAULT_COUNTRY_CODE ?? "+91");
      if (!phone) return fail("Enter a 10-digit mobile number, or leave it blank", 422, "bad_phone");
    }

    let scheduledFor: number | null = null;
    if (body.scheduledFor && !isStaff) {
      const valid = slotsForDay(camp, new Date()).some((s) => s.start === body.scheduledFor);
      if (!valid) return fail("That time slot is not available", 422, "bad_slot");
      scheduledFor = body.scheduledFor;
    }

    const { token } = q.register({
      campId: camp.id,
      stationId: body.stationId,
      name: body.name,
      age: body.age,
      phone,
      language: body.language,
      priority: body.priority,
      source: isStaff ? "desk" : scheduledFor ? "booking" : "self",
      scheduledFor,
    });
    return json({ publicId: token.publicId, label: token.label, url: `/t/${token.publicId}` }, 201);
  });
}
