"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RoomForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<{ displayName?: string; roomName?: string; code?: string }>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const roomName = String(form.get("roomName") ?? "").trim();
    const code = String(form.get("code") ?? "").trim().toUpperCase();
    const errors: typeof fields = {};
    if (!displayName) errors.displayName = "Enter your display name.";
    if (mode === "create" && !roomName) errors.roomName = "Enter a room name.";
    if (mode === "join" && code.length !== 6) errors.code = "Join code must be 6 characters.";
    setFields(errors);
    setError("");
    if (Object.keys(errors).length) return;
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = mode === "create"
        ? await supabase.rpc("create_room", { name: roomName, display_name: displayName })
        : await supabase.rpc("join_room", { code, display_name: displayName });
      if (error) throw new Error(error.message);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : `Could not ${mode} the room.`);
      setPending(false);
    }
  }

  return (
    <section className="card">
      <div className="choices" aria-label="Room setup">
        <button type="button" className={mode === "create" ? "" : "secondary"} aria-pressed={mode === "create"} disabled={pending} onClick={() => { setMode("create"); setFields({}); setError(""); }}>Create a room</button>
        <button type="button" className={mode === "join" ? "" : "secondary"} aria-pressed={mode === "join"} disabled={pending} onClick={() => { setMode("join"); setFields({}); setError(""); }}>Join a room</button>
      </div>
      <form onSubmit={handleSubmit} aria-busy={pending} noValidate>
        <label htmlFor="displayName">Your display name</label>
        <input id="displayName" name="displayName" autoComplete="nickname" required disabled={pending} aria-invalid={!!fields.displayName} aria-describedby={fields.displayName ? "displayName-error" : undefined} />
        {fields.displayName && <p className="error" id="displayName-error" role="alert">{fields.displayName}</p>}
        {mode === "create" ? <>
          <label htmlFor="roomName">Room name</label>
          <input id="roomName" name="roomName" required disabled={pending} aria-invalid={!!fields.roomName} aria-describedby={fields.roomName ? "roomName-error" : undefined} />
          {fields.roomName && <p className="error" id="roomName-error" role="alert">{fields.roomName}</p>}
        </> : <>
          <label htmlFor="code">Join code</label>
          <input id="code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={6} disabled={pending} aria-invalid={!!fields.code} aria-describedby={fields.code ? "code-error" : "code-hint"} />
          <p id="code-hint">Ask a roommate for the 6-character code.</p>
          {fields.code && <p className="error" id="code-error" role="alert">{fields.code}</p>}
        </>}
        {error && <p className="error" role="alert">Could not {mode} the room: {error} Please try again.</p>}
        <button type="submit" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? (mode === "create" ? "Creating room…" : "Joining room…") : (mode === "create" ? "Create room" : "Join room")}
        </button>
      </form>
    </section>
  );
}
