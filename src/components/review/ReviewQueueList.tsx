"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionCard, Button, Badge } from "@/components/ui";
import type { ReviewQueueItem } from "@/services/jobService";

type ReviewQueueListProps = {
  items: ReviewQueueItem[];
  approveAction: (matchId: string) => Promise<void>;
  rejectAction: (matchId: string) => Promise<void>;
  retryAction: (matchId: string) => Promise<void>;
};

export function ReviewQueueList({
  items,
  approveAction,
  rejectAction,
  retryAction
}: ReviewQueueListProps) {
  const router = useRouter();

  async function handleApprove(matchId: string) {
    await approveAction(matchId);
    router.refresh();
  }
  async function handleReject(matchId: string) {
    await rejectAction(matchId);
    router.refresh();
  }
  async function handleRetry(matchId: string) {
    await retryAction(matchId);
    router.refresh();
  }

  if (!items.length) {
    return (
      <SectionCard>
        <p className="text-ds-body text-slate-400">No jobs in review queue.</p>
        <p className="mt-1 text-ds-caption text-slate-500">
          Jobs with score 80–89 appear as ready_for_review; failed or needs_review applications appear here.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.matchId}
            className="rounded-ds-lg border border-slate-700/60 bg-slate-800/20 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-ds-body font-semibold text-slate-100">{item.title}</h3>
                <p className="text-ds-caption text-slate-500">
                  {item.company} · {item.source}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="source">{item.source}</Badge>
                  <Badge variant="neutral">Score: {item.score}</Badge>
                  {item.autoApplySupported ? (
                    <Badge variant="score-high">Auto-apply supported</Badge>
                  ) : (
                    <Badge variant="score-mid">Manual / review only</Badge>
                  )}
                  <Badge
                    variant={
                      item.applicationStatus === "failed"
                        ? "score-low"
                        : item.applicationStatus === "needs_review"
                          ? "score-mid"
                          : item.applicationStatus === "skipped_rules" || item.applicationStatus === "skipped_unsupported"
                            ? "score-mid"
                            : "default"
                    }
                  >
                    {item.applicationStatus}
                  </Badge>
                </div>
                {item.reasons.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-ds-caption text-slate-400">
                    {item.reasons.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {item.failureReason && (
                  <p className="mt-2 text-ds-caption text-amber-400">
                    Failure: {item.failureReason}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(item.applicationStatus === "ready_for_review" ||
                item.applicationStatus === "needs_review" ||
                item.applicationStatus === "skipped_rules" ||
                item.applicationStatus === "skipped_unsupported") && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(item.matchId)}
                >
                  Approve
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleReject(item.matchId)}
              >
                Reject
              </Button>
              {(item.applicationStatus === "failed" || item.applicationStatus === "needs_review") && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRetry(item.matchId)}
                >
                  Retry
                </Button>
              )}
              {item.jobUrl && (
                <Link
                  href={item.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-ds-lg border border-transparent bg-slate-100 px-3 py-1.5 text-ds-caption font-medium text-slate-900 hover:bg-white"
                >
                  Open Job
                </Link>
              )}
              <Link
                href={`/tailored/create?matchId=${encodeURIComponent(item.matchId)}`}
                className="inline-flex items-center justify-center rounded-ds-lg border border-sky-600/60 bg-sky-900/30 px-3 py-1.5 text-ds-caption font-medium text-sky-300 hover:bg-sky-800/40"
              >
                Tailor
              </Link>
              <Link
                href={`/jobs/${item.jobId}`}
                className="inline-flex items-center justify-center rounded-ds-lg border border-slate-600 bg-transparent px-3 py-1.5 text-ds-caption font-medium text-slate-300 hover:bg-slate-800"
              >
                View Details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
