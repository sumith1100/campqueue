import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // only allow same-site redirects
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/staff";
  return (
    <main className="mx-auto grid max-w-sm gap-6 px-5 pt-20">
      <h1 className="text-4xl font-bold">Volunteer sign-in</h1>
      <p className="text-ink-soft">Enter the PIN the camp organiser gave you.</p>
      <LoginForm next={safe} />
    </main>
  );
}
