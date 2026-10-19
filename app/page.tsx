import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getRoomContext } from "@/lib/room-context";
import { RequestError } from "./components/request-error";
import { SignOutButton } from "./components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { choreColumns, type Chore, type Member } from "@/lib/chores";
import { Board } from "./board";
import { BoardSkeleton } from "./components/board-skeleton";

export default function Home() {
  return (
    <Suspense fallback={<main className="shell" role="status">Loading ChoreCycle…</main>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const { userId, room, error } = await getRoomContext();
  if (error) return <RequestError message={error} retry="/" />;
  if (!userId) redirect("/login");
  if (!room) redirect("/start");
  return (
    <main className="shell">
      <p className="eyebrow">ChoreCycle</p>
      <h1>{room.name}</h1>
      <SignOutButton />
      <Suspense fallback={<BoardSkeleton />}>
        <ChoreListData roomId={room.id} userId={userId} />
      </Suspense>
    </main>
  );
}

async function ChoreListData({ roomId, userId }: { roomId: string; userId: string }) {
  let chores: Chore[];
  let members: Member[];
  try {
    const supabase = await createClient();
    const [choreResult, memberResult] = await Promise.all([
      supabase.from("chores").select(choreColumns).eq("room_id", roomId)
        .order("status", { ascending: false }).order("due_date").order("created_at").order("id"),
      supabase.from("members").select("id, user_id, display_name").eq("room_id", roomId).order("display_name"),
    ]);
    const errors = [
      choreResult.error && `Could not load chores: ${choreResult.error.message}`,
      memberResult.error && `Could not load room members: ${memberResult.error.message}`,
    ].filter(Boolean);
    if (errors.length) throw new Error(errors.join(" "));
    chores = choreResult.data as Chore[];
    members = memberResult.data as Member[];
    if (!members.some((member) => member.user_id === userId)) {
      throw new Error("Could not find your room membership. Please try again.");
    }
  } catch (error) {
    return (
      <section className="board" aria-label="Room chores">
        <h2>Could not load chores</h2>
        <p className="error" role="alert">{error instanceof Error ? error.message : "Could not load the board."}</p>
        <form action="/" method="get"><button type="submit">Try again</button></form>
      </section>
    );
  }
  return <Board roomId={roomId} userId={userId} members={members} initialChores={chores} />;
}
