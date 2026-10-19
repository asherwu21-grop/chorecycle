import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getRoomContext } from "@/lib/room-context";
import { RequestError } from "../components/request-error";
import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={<main className="shell" role="status">Loading ChoreCycle…</main>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const { userId, room, error } = await getRoomContext();
  if (error) return <RequestError message={error} retry="/login" />;
  if (userId) redirect(room ? "/" : "/start");
  const params = await searchParams;
  return (
    <main className="shell">
      <h1>ChoreCycle</h1>
      <p>Share chores with your roommates.</p>
      <LoginForm confirmationError={params.error} />
    </main>
  );
}
