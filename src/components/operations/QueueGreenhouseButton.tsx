"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QueueGreenhouseButtonProps = {
  queueAction: () => Promise<{ queued: number; message: string }>;
};

export function QueueGreenhouseButton({ queueAction }: QueueGreenhouseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await queueAction();
      setMessage(result.message);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to queue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-ds-lg border border-emerald-600 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-800/40 disabled:opacity-50"
      >
        {loading ? "Queueing…" : "Queue Greenhouse auto-apply jobs"}
      </button>
      {message && <p className="text-ds-caption text-slate-400">{message}</p>}
    </div>
  );
}
