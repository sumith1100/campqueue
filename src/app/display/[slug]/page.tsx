import { notFound } from "next/navigation";
import { DisplayBoard } from "@/components/display-board";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Queue display" };

export default async function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const q = getQueue();
  const camp = q.getCampBySlug((await params).slug);
  if (!camp) notFound();
  return <DisplayBoard initial={q.getCampSnapshot(camp.id)} />;
}
