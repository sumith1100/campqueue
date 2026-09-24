import { notFound } from "next/navigation";
import { AdminCamp } from "@/components/admin-camp";
import { guard } from "@/lib/guard";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organiser" };

export default async function AdminCampPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await guard("admin", `/admin/${slug}`);
  const q = getQueue();
  const camp = q.getCampBySlug(slug);
  if (!camp) notFound();
  const stations = q.listStations(camp.id).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    color: s.color,
    counters: s.counters,
    defaultServiceSeconds: s.defaultServiceSeconds,
    nextStationId: s.nextStationId,
    acceptsRegistration: s.acceptsRegistration,
  }));
  return <AdminCamp camp={{ slug: camp.slug, name: camp.name }} stations={stations} initial={q.getCampSnapshot(camp.id)} />;
}
