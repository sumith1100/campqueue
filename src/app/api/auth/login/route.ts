import { cookies } from "next/headers";
import { createSessionValue, roleForPin, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIp, fail, handle, json, rateLimited, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validators";

export function POST(req: Request) {
  return handle(async () => {
    if (rateLimited(`login:${clientIp(req)}`, 8, 60_000)) return fail("Too many attempts. Wait a minute.", 429, "rate_limited");
    const { pin } = loginSchema.parse(await readJson(req));
    const role = roleForPin(pin);
    if (!role) return fail("That PIN is not right", 401, "bad_pin");
    (await cookies()).set(SESSION_COOKIE, createSessionValue(role), sessionCookieOptions);
    return json({ role });
  });
}
