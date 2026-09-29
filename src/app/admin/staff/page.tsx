import { StaffManagement } from "@/components/staff-management";
import { guard } from "@/lib/guard";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff management" };

export default async function StaffManagementPage() {
  await guard("admin", "/admin/staff");
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-5 pb-20 pt-12">
      <div>
        <h1 className="text-4xl font-bold">Staff & volunteers</h1>
        <p className="mt-2 text-ink-soft">Create individual accounts, assign designations and activate or deactivate access.</p>
      </div>
      <StaffManagement initial={listUsers()} />
    </main>
  );
}
