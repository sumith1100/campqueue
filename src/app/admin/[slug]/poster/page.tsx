import { notFound } from "next/navigation";
import { PosterView } from "@/components/poster-view";
import { guard } from "@/lib/guard";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrance poster" };

export default async function PosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await guard("admin", `/admin/${slug}/poster`);
  const camp = getQueue().getCampBySlug(slug);
  if (!camp) notFound();
  return <PosterView slug={camp.slug} name={camp.name} venue={camp.venue} />;
}
