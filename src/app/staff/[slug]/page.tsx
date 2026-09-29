import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { StaffConsole } from "@/components/staff-console";
import { guard } from "@/lib/guard";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volunteer console" };

export default async function StaffCampPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await guard("staff", `/staff/${slug}`);
  const q = getQueue();
  const camp = q.getCampBySlug(slug);
  if (!camp) notFound();
  const session = await getCurrentUser();
  const stations = q.listStations(camp.id).map((s) => ({ id: s.id, name: s.name, color: s.color, counters: s.counters, nextStationId: s.nextStationId }));
  return <StaffConsole camp={{ slug: camp.slug, name: camp.name, graceMinutes: camp.graceMinutes }} stations={stations} initial={q.getCampSnapshot(camp.id)} staff={session?.name ? { name: session.name, designation: session.designation ?? "" } : undefined} />;
}