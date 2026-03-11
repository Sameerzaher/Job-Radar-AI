import type { SyncResult } from "@/services/syncService";
import { SectionCard } from "@/components/ui";

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
      <SectionCard className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ds-caption font-medium uppercase tracking-wider text-slate-500">
            Last sync
          </p>
          <p className="mt-1 text-ds-body text-slate-300">Never</p>
        </div>
        <p className="text-ds-caption text-slate-500">
          Run the cron worker or trigger sync via API to populate.
        </p>
      </SectionCard>
    );
  }

  const finishedAt = new Date(lastSync.finishedAt);
  return (
    <SectionCard className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-ds-caption font-medium uppercase tracking-wider text-slate-500">
          Last sync
        </p>
        <p className="mt-1 text-ds-body font-medium text-slate-100">
          {formatRelativeTime(finishedAt)}
        </p>
        <p className="text-ds-caption text-slate-500">
          {finishedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-ds-caption text-slate-400">
        <span>{lastSync.jobsFetched} fetched</span>
        <span>{lastSync.jobsInserted} inserted</span>
        <span>{lastSync.duplicatesSkipped} duplicates</span>
        {lastSync.skippedInvalidUrl != null && lastSync.skippedInvalidUrl > 0 && (
          <span>{lastSync.skippedInvalidUrl} invalid URL</span>
        )}
        <span>{lastSync.matchesCreated} matches</span>
        {lastSync.sourceLabel && (
          <span className="text-slate-500">({lastSync.sourceLabel})</span>
        )}
      </div>
    </SectionCard>
  );
}
