import { redirect } from "next/navigation";
import { getRoomContext } from "@/lib/room-context";
import { RequestError } from "./components/request-error";
import { SignOutButton } from "./components/sign-out-button";

export default async function Home() {
  const { userId, room, error } = await getRoomContext();
  if (error) return <RequestError message={error} retry="/" />;
  if (!userId) redirect("/login");
  if (!room) redirect("/start");
  return (
    <main className="shell">
      <p className="eyebrow">ChoreCycle</p>
      <h1>{room.name}</h1>
      <SignOutButton />
    </main>
  );
}
