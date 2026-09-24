import Link from "next/link";
import { notFound } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import { guard } from "@/lib/guard";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register a walk-in" };

export default async function DeskRegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await guard("staff", `/staff/${slug}/register`);
  const q = getQueue();
  const camp = q.getCampBySlug(slug);
  if (!camp) notFound();
  const snap = q.getCampSnapshot(camp.id);
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-5 pb-16 pt-6">
      <div className="no-print">
        <Link className="font-semibold underline" href={`/staff/${camp.slug}`}>
          Back to console
        </Link>
        <h1 className="mt-3 text-4xl font-bold">Register a walk-in</h1>
        <p className="text-ink-soft">{camp.name}</p>
      </div>
      <RegisterForm
        desk
        campSlug={camp.slug}
        slots={[]}
        stations={snap.stations.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          color: s.color,
          waiting: s.waiting,
          waitMinutes: Math.max(1, Math.round(s.newArrivalWaitSeconds / 60)),
          isPaused: false,
        }))}
      />
    </main>
  );
}
