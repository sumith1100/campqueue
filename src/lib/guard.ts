import { redirect } from "next/navigation";
import { hasRole, type Role } from "@/lib/auth";

/** Server-component guard: sends signed-out visitors to the PIN page and back again. */
export async function guard(role: Role, next: string): Promise<void> {
  if (!(await hasRole(role))) redirect(`/login?next=${encodeURIComponent(next)}`);
}
