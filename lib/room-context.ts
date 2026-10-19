import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const getRoomContext = cache(async () => {
  // Auth checks read the current time internally and must run for a real request.
  await connection();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error && error.name !== "AuthSessionMissingError") throw error;
    const userId = data?.claims?.sub;
    if (!userId) return { userId: null, room: null, error: null };
    const { data: member, error: memberError } = await supabase
      .from("members").select("room_id").eq("user_id", userId).maybeSingle();
    if (memberError) throw new Error(`Could not load your membership: ${memberError.message}`);
    if (!member) return { userId, room: null, error: null };
    const { data: room, error: roomError } = await supabase
      .from("rooms").select("id, name").eq("id", member.room_id).single();
    if (roomError) throw new Error(`Could not load your room: ${roomError.message}`);
    return { userId, room, error: null };
  } catch (error) {
    return { userId: null, room: null, error: error instanceof Error ? error.message : "Could not load your account. Please try again." };
  }
});
