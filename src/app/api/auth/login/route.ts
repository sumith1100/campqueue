import { cookies } from "next/headers";
import { createSessionValue, roleForPin, SESSION_COOKIE, sessionCookieOptions, signInWithCredentials } from "@/lib/auth";
import { clientIp, fail, handle, json, rateLimited, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validators";

export function POST(req: Request) {
  return handle(async () => {
    if (rateLimited(`login:${clientIp(req)}`, 8, 60_000)) return fail("Too many attempts. Wait a minute.", 429, "rate_limited");
    const { userId, pin } = loginSchema.parse(await readJson(req));
    const staff = userId ? await signInWithCredentials(userId, pin) : null;
    const role = staff?.role ?? roleForPin(pin);
    if (!role) return fail("Name or PIN is not correct", 401, "bad_credentials");
    const session = staff ?? { userId: null, role: "admin" as const };
    (await cookies()).set(SESSION_COOKIE, createSessionValue(session.userId, role), sessionCookieOptions);
    return json({ role, name: staff?.name, designation: staff?.designation });
  });
}
