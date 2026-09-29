import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User, type UserRole } from "@/lib/db/schema";

const SCRYPT_KEY_LENGTH = 64;

function hashPin(pin: string, salt = randomBytes(16).toString("hex")): string {
  const hash = scryptSync(pin, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  try {
    const actual = scryptSync(pin, salt, SCRYPT_KEY_LENGTH);
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export type PublicUser = Pick<User, "id" | "name" | "designation" | "role">;

export function listActiveUsers(): PublicUser[] {
  return getDb()
    .select({ id: users.id, name: users.name, designation: users.designation, role: users.role })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name))
    .all();
}

export function listUsers(): Omit<User, "pinHash" | "pinSalt">[] {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      designation: users.designation,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name))
    .all();
}

export function findUser(id: string): User | null {
  return getDb().select().from(users).where(eq(users.id, id)).get() ?? null;
}

export function createUser(input: {
  name: string;
  designation: string;
  role: UserRole;
  pin: string;
}): PublicUser {
  const now = Date.now();
  const id = randomUUID();
  const stored = hashPin(input.pin);
  getDb()
    .insert(users)
    .values({
      id,
      name: input.name,
      designation: input.designation,
      role: input.role,
      pinHash: stored,
      active: true,
      createdAt: now,
    })
    .run();
  return { id, name: input.name, designation: input.designation, role: input.role };
}

export function authenticateUser(id: string, pin: string): PublicUser | null {
  const user = findUser(id);
  if (!user || !user.active || !verifyPin(pin, user.pinHash)) return null;
  return { id: user.id, name: user.name, designation: user.designation, role: user.role };
}

export function setUserActive(id: string, active: boolean): boolean {
  const result = getDb().update(users).set({ active }).where(eq(users.id, id)).run();
  return result.changes > 0;
}
