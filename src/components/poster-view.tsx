"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function PosterView({ slug, name, venue }: { slug: string; name: string; venue: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(process.env.NEXT_PUBLIC_BASE_URL || window.location.origin), []);
  const url = `${origin}/c/${slug}`;

  return (
    <main className="mx-auto grid min-h-dvh max-w-3xl content-center justify-items-center gap-8 bg-white px-8 py-12 text-center">
      <div>
        <h1 className="token-numeral text-[clamp(3rem,10vw,6rem)]">Get your token</h1>
        <p className="mt-3 text-2xl text-ink-soft">Point your phone camera at the code. Then wait anywhere you like.</p>
      </div>
      <div className="rounded-3xl border-4 border-ink p-6">{origin ? <QRCodeSVG value={url} size={340} marginSize={0} /> : <div className="size-[340px]" />}</div>
      <div>
        <p className="text-3xl font-bold">{name}</p>
        {venue && <p className="text-xl text-ink-soft">{venue}</p>}
        <p className="mt-4 text-lg text-ink-soft">No phone? Ask any volunteer to register you.</p>
      </div>
      <button className="btn btn-primary no-print" onClick={() => window.print()}>
        Print
      </button>
    </main>
  );
}
