import Link from "next/link";
import { guard } from "@/lib/guard";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volunteer console" };

export default async function StaffHome() {
  await guard("staff", "/staff");
  const camps = getQueue().listCamps();
  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-5 pt-12">
      <h1 className="text-4xl font-bold">Which camp are you helping at?</h1>
      {camps.length === 0 ? (
        <p className="text-ink-soft">No camps yet. Ask an organiser to create one.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {camps.map((c) => (
            <li key={c.id}>
              <Link className="flex items-center justify-between py-4 text-xl font-semibold hover:underline" href={`/staff/${c.slug}`}>
                {c.name}
                <span className="text-ink-soft">{c.venue}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
