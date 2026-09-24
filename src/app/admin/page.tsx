import Link from "next/link";
import { CreateCampForm } from "@/components/create-camp-form";
import { guard } from "@/lib/guard";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organiser" };

export default async function AdminHome() {
  await guard("admin", "/admin");
  const camps = getQueue().listCamps();
  return (
    <main className="mx-auto grid max-w-2xl gap-10 px-5 pb-20 pt-12">
      <section className="grid gap-4">
        <h1 className="text-4xl font-bold">Your camps</h1>
        {camps.length === 0 ? (
          <p className="text-ink-soft">Nothing here yet. Create your first camp below.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {camps.map((c) => (
              <li key={c.id}>
                <Link className="flex items-center justify-between py-4 text-xl font-semibold hover:underline" href={`/admin/${c.slug}`}>
                  {c.name}
                  <span className="text-ink-soft">{c.venue}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-4">
        <h2 className="text-2xl font-bold">Create a camp</h2>
        <CreateCampForm />
      </section>
    </main>
  );
}
