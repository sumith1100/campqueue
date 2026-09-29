import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User, type UserRole } from "@/lib/db/schema";
function hashPin(pin: string): string { const salt = randomBytes(16).toString("hex"); return salt + ":" + scryptSync(pin, salt, 64).toString("hex"); }
function verifyPin(pin: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":"); if (!salt || !expectedHex) return false;
  try { const actual=scryptSync(pin,salt,64), expected=Buffer.from(expectedHex,"hex"); return expected.length===actual.length && timingSafeEqual(actual,expected); } catch { return false; }
}
export type PublicUser = Pick<User, "id" | "name" | "designation" | "role">;
export function listActiveUsers(): PublicUser[] { return getDb().select({id:users.id,name:users.name,designation:users.designation,role:users.role}).from(users).where(eq(users.active,true)).orderBy(asc(users.name)).all(); }
export function listUsers() { return getDb().select({id:users.id,name:users.name,designation:users.designation,role:users.role,active:users.active,createdAt:users.createdAt}).from(users).orderBy(asc(users.name)).all(); }
export function findUser(id:string): User|null { return getDb().select().from(users).where(eq(users.id,id)).get() ?? null; }
export function createUser(input:{name:string;designation:string;role:UserRole;pin:string}):PublicUser {
  const id=randomUUID(); getDb().insert(users).values({id,name:input.name,designation:input.designation,role:input.role,pinHash:hashPin(input.pin),active:true,createdAt:Date.now()}).run();
  return {id,name:input.name,designation:input.designation,role:input.role};
}
export function authenticateUser(id:string,pin:string):PublicUser|null { const user=findUser(id); if(!user||!user.active||!verifyPin(pin,user.pinHash)) return null; return {id:user.id,name:user.name,designation:user.designation,role:user.role}; }
export function setUserActive(id:string,active:boolean):boolean { return getDb().update(users).set({active}).where(eq(users.id,id)).run().changes>0; }
