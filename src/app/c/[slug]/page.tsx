import { notFound } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import { slotsForDay } from "@/lib/queue/engine";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const camp = getQueue().getCampBySlug((await params).slug);
  return { title: camp ? `Get a token · ${camp.name}` : "Camp not found" };
}

export default async function CampRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = getQueue();
  const camp = q.getCampBySlug(slug);
  if (!camp) notFound();

  const snap = q.getCampSnapshot(camp.id);
  const now = Date.now();
  const slots = slotsForDay(camp, new Date())
    .filter((s) => s.end > now)
    .map((s) => ({ start: s.start, label: s.label, left: camp.slotCapacity - q.countBookedInSlot(camp.id, s.start) }));

  return (
    <main className="mx-auto grid max-w-xl gap-6 px-5 pb-16 pt-8">
      <header>
        <h1 className="text-4xl font-bold leading-tight">{camp.name}</h1>
        {camp.venue && <p className="mt-1 text-ink-soft">{camp.venue}</p>}
      </header>
      <RegisterForm
        campSlug={camp.slug}
        slots={slots}
        stations={snap.stations
          .filter((s) => s.acceptsRegistration)
          .map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            color: s.color,
            waiting: s.waiting,
            waitMinutes: Math.max(1, Math.round(s.newArrivalWaitSeconds / 60)),
            isPaused: s.isPaused,
          }))}
      />
    </main>
  );
}
