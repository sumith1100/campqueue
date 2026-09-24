import { notFound } from "next/navigation";
import { TokenTracker } from "@/components/token-tracker";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your token", robots: { index: false } };

export default async function TokenPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const status = getQueue().getTokenStatus(publicId);
  if (!status) notFound();
  return (
    <main className="mx-auto grid max-w-xl gap-4 px-5 pb-16 pt-6">
      <TokenTracker initial={status} />
    </main>
  );
}
