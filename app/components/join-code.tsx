"use client";

import { useEffect, useRef, useState } from "react";

export function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [failed, setFailed] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeout.current !== null) clearTimeout(timeout.current);
  }, []);

  async function copyCode() {
    if (timeout.current !== null) clearTimeout(timeout.current);
    setCopied(false);
    setFailed(false);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="join-code">
      <div className="join-code-controls">
        <span className="join-code-chip">Join code: <strong>{code}</strong></span>
        <button type="button" className="secondary" disabled={copying} onClick={copyCode}>
          <span aria-live="polite">{copied ? "Copied" : "Copy code"}</span>
        </button>
      </div>
      {failed && <p className="error" role="alert">Copy failed. Copy the join code by hand: <strong>{code}</strong>. Try Copy code again.</p>}
    </div>
  );
}
