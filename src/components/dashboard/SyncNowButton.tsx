"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerSync } from "@/app/dashboard/actions";
import { SectionCard } from "@/components/ui";

export function SyncNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    try {
      const out = await triggerSync();
      if (out.ok) {
        const r = out.result;
        setMessage({
          type: "success",
          text: `${r.jobsFetched} fetched, ${r.jobsInserted} inserted, ${r.duplicatesSkipped} duplicates, ${r.matchesCreated} matches`
        });
        router.refresh();
      } else {
        setMessage({ type: "error", text: out.error });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard>
      <h2 className="text-ds-title font-semibold text-slate-100">
        Job ingestion pipeline
      </h2>
      <p className="mt-2 text-ds-body text-slate-500">
        Jobs come from Greenhouse and Lever. Scheduled sync runs every 6 hours via{" "}
        <code className="rounded-ds-md border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-ds-caption text-slate-300">
          npm run sync:cron
        </code>
        . Or sync now:
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={loading}
          className="rounded-ds-md border border-slate-600 bg-slate-700 px-4 py-2 text-ds-body font-medium text-slate-100 hover:bg-slate-600 disabled:opacity-50"
        >
          {loading ? "Syncing…" : "Sync now"}
        </button>
        {message && (
          <p
            className={`text-ds-caption ${
              message.type === "success" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
      <p className="mt-2 text-ds-caption text-slate-500">
        API: <code className="rounded border border-slate-700/80 bg-slate-800/60 px-1 py-0.5">POST /api/admin/sync</code>
        {" "}(optional x-api-key if ADMIN_API_KEY is set)
      </p>
    </SectionCard>
  );
}
