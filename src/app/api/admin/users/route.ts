import { handle, json, readJson, requireRole } from "@/lib/http";
import { createUser, listUsers } from "@/lib/users";
import { userCreateSchema } from "@/lib/validators";

export async function GET() {
  const denied = await requireRole("admin");
  if (denied) return denied;
  return json({ users: listUsers() });
}

export function POST(req: Request) {
  return handle(async () => {
    const denied = await requireRole("admin");
    if (denied) return denied;
    const input = userCreateSchema.parse(await readJson(req));
    const user = createUser(input);
    return json({ user }, 201);
  });
}
