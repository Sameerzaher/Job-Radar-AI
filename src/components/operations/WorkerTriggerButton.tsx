"use client";

import { useState } from "react";

export function WorkerTriggerButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleTrigger() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/worker/auto-apply/trigger", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        if (data.ran && data.result) {
          setMessage(
            `Run completed: queued=${data.result.queued} applied=${data.result.applied} failed=${data.result.failed} needs_review=${data.result.needsReview}`
          );
        } else {
          setMessage(data.skippedReason ? `Skipped: ${data.skippedReason}` : "Run completed (no jobs processed).");
        }
      } else {
        setMessage(`Error: ${data.detail ?? data.error}`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleTrigger}
        disabled={loading}
        className="rounded-ds-lg border border-sky-600 bg-sky-900/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-800/40 disabled:opacity-50"
      >
        {loading ? "Running…" : "Run auto-apply now (one cycle)"}
      </button>
      {message && <p className="text-ds-caption text-slate-400">{message}</p>}
    </div>
  );
}
