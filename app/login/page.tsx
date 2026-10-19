import { redirect } from "next/navigation";
import { getRoomContext } from "@/lib/room-context";
import { RequestError } from "../components/request-error";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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
