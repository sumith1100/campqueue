import { LoginForm } from "@/components/login-form";
import { listActiveUsers } from "@/lib/users";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/staff";
  return (
    <main className="mx-auto grid max-w-sm gap-6 px-5 pt-20">
      <h1 className="text-4xl font-bold">Camp staff sign-in</h1>
      <p className="text-ink-soft">Select your registered name and enter your personal PIN.</p>
      <LoginForm next={safe} users={listActiveUsers()} />
      <p className="text-sm text-ink-soft">Organisers sign in with the administrator PIN.</p>
    </main>
  );
}
