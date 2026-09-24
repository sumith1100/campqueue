import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type Role = "staff" | "admin";
export const SESSION_COOKIE = "cq_session";
const SESSION_HOURS = 14;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set (16+ characters)");
    return "dev-only-secret-change-me";
  }
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Returns the role a PIN unlocks, or null. */
export function roleForPin(pin: string): Role | null {
  const admin = process.env.ADMIN_PIN ?? "9999";
  const staff = process.env.STAFF_PIN ?? "1234";
  if (safeEqual(pin, admin)) return "admin";
  if (safeEqual(pin, staff)) return "staff";
  return null;
}

export function createSessionValue(role: Role, now = Date.now()): string {
  const payload = `${role}.${now + SESSION_HOURS * 3_600_000}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionValue(value: string | undefined, now = Date.now()): Role | null {
  if (!value) return null;
  const [role, expires, sig] = value.split(".");
  if (!role || !expires || !sig) return null;
  if (!safeEqual(sig, sign(`${role}.${expires}`))) return null;
  if (Number(expires) < now) return null;
  return role === "admin" || role === "staff" ? role : null;
}

export async function getSession(): Promise<Role | null> {
  const jar = await cookies();
  return readSessionValue(jar.get(SESSION_COOKIE)?.value);
}

/** Admins can do everything staff can. */
export async function hasRole(required: Role): Promise<boolean> {
  const role = await getSession();
  return required === "staff" ? role !== null : role === "admin";
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};
