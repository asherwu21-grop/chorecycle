import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getRoomContext } from "@/lib/room-context";
import { RequestError } from "../components/request-error";
import { SignOutButton } from "../components/sign-out-button";
import { RoomForm } from "./room-form";

export default function StartPage() {
  return (
    <Suspense fallback={<main className="shell" role="status">Loading ChoreCycle…</main>}>
      <StartContent />
    </Suspense>
  );
}

async function StartContent() {
  const { userId, room, error } = await getRoomContext();
  if (error) return <RequestError message={error} retry="/start" />;
  if (!userId) redirect("/login");
  if (room) redirect("/");
  return (
    <main className="shell">
      <header className="app-header"><p className="eyebrow"><span className="brand-mark" aria-hidden="true">↻</span>ChoreCycle</p><details className="header-menu"><summary aria-label="Room menu">•••</summary><SignOutButton /></details></header>
      <h1>Find your room</h1>
      <p>Create a room for your household, or get a join code from a roommate.</p>
      <RoomForm />
    </main>
  );
}
