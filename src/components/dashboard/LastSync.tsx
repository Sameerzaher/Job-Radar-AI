import type { SyncResult } from "@/services/syncService";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { dateStyle: "short" });
}

type LastSyncProps = {
  lastSync: SyncResult | null;
};

export function LastSync({ lastSync }: LastSyncProps) {
  if (!lastSync) {
    return (
      <div className="glass-panel flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            Last sync
          </p>
          <p className="mt-1 text-sm text-slate-300">Never</p>
        </div>
        <p className="text-xs text-slate-500">
          Run the cron worker or trigger sync via API to populate.
        </p>
      </div>
    );
  }

  const finishedAt = new Date(lastSync.finishedAt);
  return (
    <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
          Last sync
        </p>
        <p className="mt-1 text-sm font-medium text-slate-100">
          {formatRelativeTime(finishedAt)}
        </p>
        <p className="text-xs text-slate-500">
          {finishedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <span>{lastSync.jobsFetched} fetched</span>
        <span>{lastSync.jobsInserted} inserted</span>
        <span>{lastSync.duplicatesSkipped} skipped</span>
        <span>{lastSync.matchesCreated} matches</span>
        {lastSync.sourceLabel && (
          <span className="text-slate-500">({lastSync.sourceLabel})</span>
        )}
      </div>
    </div>
  );
}
