"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button className="secondary" disabled={pending} onClick={async () => {
        setPending(true);
        setError("");
        try {
          const { error } = await createClient().auth.signOut();
          if (error) throw error;
          router.replace("/login");
          router.refresh();
        } catch (error) {
          setError(error instanceof Error ? error.message : "Could not sign out.");
          setPending(false);
        }
      }}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p className="error" role="alert">{error} Try signing out again.</p>}
    </div>
  );
}
