import { redirect } from "next/navigation";
import { getRoomContext } from "@/lib/room-context";
import { RequestError } from "../components/request-error";
import { SignOutButton } from "../components/sign-out-button";
import { RoomForm } from "./room-form";

export default async function StartPage() {
  const { userId, room, error } = await getRoomContext();
  if (error) return <RequestError message={error} retry="/start" />;
  if (!userId) redirect("/login");
  if (room) redirect("/");
  return (
    <main className="shell">
      <p className="eyebrow">ChoreCycle</p>
      <h1>Find your room</h1>
      <p>Create a room for your household, or get a join code from a roommate.</p>
      <RoomForm />
      <SignOutButton />
    </main>
  );
}
