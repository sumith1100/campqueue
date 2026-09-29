import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { authenticateUser, findUser } from "@/lib/users";

export type Role = "staff" | "admin";
export type Session = { userId: string | null; role: Role; name?: string; designation?: string };
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
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function roleForPin(pin: string): Role | null {
  const admin = process.env.ADMIN_PIN ?? "9999";
  return safeEqual(pin, admin) ? "admin" : null;
}

export function createSessionValue(userId: string | null, role: Role, now = Date.now()): string {
  const payload = (userId ?? "admin") + "." + role + "." + (now + SESSION_HOURS * 3600000);
  return payload + "." + sign(payload);
}

export function readSessionValue(value: string | undefined, now = Date.now()): Session | null {
  if (!value) return null;
  const [userId, role, expires, sig] = value.split(".");
  if (!userId || !role || !expires || !sig) return null;
  const payload = userId + "." + role + "." + expires;
  if (!safeEqual(sig, sign(payload)) || Number(expires) < now) return null;
  if (role === "admin" && userId === "admin") return { userId: null, role: "admin" };
  if (role !== "staff") return null;
  const user = findUser(userId);
  if (!user || !user.active) return null;
  return { userId: user.id, role: "staff", name: user.name, designation: user.designation };
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSessionValue(jar.get(SESSION_COOKIE)?.value);
}

export async function getCurrentUser(): Promise<Session | null> {
  return getSession();
}

export async function hasRole(required: Role): Promise<boolean> {
  const session = await getSession();
  return required === "staff" ? session !== null : session?.role === "admin";
}

export async function signInWithCredentials(userId: string, pin: string): Promise<Session | null> {
  const user = authenticateUser(userId, pin);
  return user ? { userId: user.id, role: "staff", name: user.name, designation: user.designation } : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};
