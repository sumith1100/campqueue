import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export default async function Home() {
  const q = getQueue();
  const camps = q.listCamps();
  const role = await getSession();

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-5 pb-20 pt-14">
      <header className="grid gap-4">
        <p className="token-numeral text-[clamp(4rem,16vw,9rem)]">
          Take a
          <br />
          number.
        </p>
        <p className="max-w-[34ch] text-2xl leading-snug text-ink-soft">
          Wait wherever you are comfortable. We will call you when it is your turn.
        </p>
      </header>

      <section aria-labelledby="camps" className="grid gap-3">
        <h2 id="camps" className="text-2xl font-bold">
          Camps
        </h2>
        {camps.length === 0 ? (
          <p className="text-ink-soft">
            No camps yet. {role === "admin" ? <Link className="font-semibold underline" href="/admin">Create the first one.</Link> : "An organiser needs to create one."}
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {camps.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-xl font-semibold">{c.name}</p>
                  {c.venue && <p className="text-ink-soft">{c.venue}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="btn btn-primary" href={`/c/${c.slug}`}>
                    Get a token
                  </Link>
                  <Link className="btn btn-quiet" href={`/display/${c.slug}`}>
                    Display screen
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex flex-wrap gap-4 text-ink-soft">
        <Link className="font-semibold underline" href="/staff">
          Volunteers
        </Link>
        <Link className="font-semibold underline" href="/admin">
          Organisers
        </Link>
      </footer>
    </main>
  );
}
