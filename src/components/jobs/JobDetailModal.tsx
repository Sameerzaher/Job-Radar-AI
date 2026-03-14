"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JobWithScore } from "@/services/jobService";
import type { JobStatus } from "@/models/Job";
import { getValidJobUrl } from "@/lib/urlValidation";
import { Badge, ScoreBadge, Button } from "@/components/ui";

type JobDetailModalProps = {
  job: JobWithScore;
  onClose: () => void;
  updateStatusAction: (jobId: string, status: JobStatus) => Promise<void>;
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  new: "New",
  queued: "Queued",
  approved: "Approved",
  applying: "Applying",
  applied: "Applied",
  ready_for_review: "Ready for review",
  needs_review: "Needs review",
  failed: "Failed",
  rejected: "Rejected",
  skipped_rules: "Skipped (rules)",
  skipped_unsupported: "Skipped (unsupported)"
};

function getApplicationStatusLabel(status: string | undefined): string {
  if (!status) return "New";
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

export function JobDetailModal({
  job,
  onClose,
  updateStatusAction
}: JobDetailModalProps) {
  const router = useRouter();
  const id = job._id.toString();
  const [applicationStatus, setApplicationStatus] = useState<string | undefined>(job.applicationStatus);
  const [queueLoading, setQueueLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; success: boolean } | null>(null);

  const canQueue =
    job.source === "Greenhouse" &&
    job.autoApplySupported === true &&
    job.matchId &&
    (applicationStatus === "new" || applicationStatus === "ready_for_review");
  const canOverrideRules =
    job.matchId &&
    applicationStatus === "skipped_rules" &&
    job.source === "Greenhouse" &&
    job.autoApplySupported === true;
  const isQueued = applicationStatus === "queued" || applicationStatus === "approved" || applicationStatus === "applying";
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);

  async function handleStatus(status: JobStatus) {
    await updateStatusAction(id, status);
    router.refresh();
    onClose();
  }

  async function handleQueueForAutoApply() {
    if (!job.matchId || queueLoading) return;
    setQueueLoading(true);
    try {
      const res = await fetch("/api/apply/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: job.matchId })
      });
      const data = await res.json();
      if (data.ok) {
        setApplicationStatus("queued");
        setToast({ message: "Job added to auto-apply queue", success: true });
        setTimeout(() => setToast(null), 3000);
        router.refresh();
      } else {
        setToast({ message: data.error ?? "Failed to queue", success: false });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ message: "Failed to queue", success: false });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setQueueLoading(false);
    }
  }

  async function handleOverrideRulesAndQueue() {
    if (!job.matchId || overrideLoading) return;
    setOverrideConfirmOpen(false);
    setOverrideLoading(true);
    try {
      const res = await fetch("/api/apply/override-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: job.matchId })
      });
      const data = await res.json();
      if (data.ok) {
        setApplicationStatus("queued");
        setToast({ message: "Rules overridden; job sent to auto-apply queue", success: true });
        setTimeout(() => setToast(null), 3000);
        router.refresh();
      } else {
        setToast({ message: data.error ?? "Failed to override", success: false });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ message: "Failed to override", success: false });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setOverrideLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="ds-card max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-ds-title font-semibold text-white">{job.title}</h2>
            <p className="mt-1 text-ds-body text-slate-500">
              {job.company} · {job.location}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ScoreBadge score={job.score} />
              <Badge variant="status">{job.status}</Badge>
              <Badge
                variant={
                  applicationStatus === "applied"
                    ? "score-high"
                    : applicationStatus === "queued" || applicationStatus === "approved"
                      ? "score-mid"
                      : applicationStatus === "needs_review" || applicationStatus === "failed"
                        ? "score-low"
                        : "neutral"
                }
              >
                {getApplicationStatusLabel(applicationStatus)}
              </Badge>
              {job.rulesOverridden && (
                <Badge variant="neutral" className="border-amber-500/50 text-amber-200">
                  Rules overridden
                </Badge>
              )}
              {job.source && (
                <Badge
                  variant={
                    job.source === "Lever"
                      ? "source-lever"
                      : job.source === "Workable"
                        ? "source-workable"
                        : "source"
                  }
                >
                  {job.source}
                </Badge>
              )}
            </div>
            {toast && (
              <div
                className={`mt-3 rounded-ds-lg border px-3 py-2 text-sm ${
                  toast.success
                    ? "border-emerald-600/60 bg-emerald-900/30 text-emerald-200"
                    : "border-amber-600/60 bg-amber-900/30 text-amber-200"
                }`}
              >
                {toast.message}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="!p-1.5"
            aria-label="Close"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {job.reasons?.length > 0 && (
          <div className="mt-5 border-t border-slate-800/80 pt-5">
            <p className="text-ds-caption font-medium text-slate-500">Match reasons</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ds-body text-slate-300">
              {job.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {(job.matchedSkills?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="text-ds-caption font-medium text-slate-500">Matched skills</p>
            <p className="mt-0.5 text-ds-body text-slate-300">{job.matchedSkills!.join(", ")}</p>
          </div>
        )}

        {(job.missingSkills?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="text-ds-caption font-medium text-slate-500">Missing skills</p>
            <p className="mt-0.5 text-ds-body text-slate-300">{job.missingSkills!.join(", ")}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-5">
          {canQueue && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleQueueForAutoApply}
              disabled={queueLoading}
            >
              {queueLoading ? "Queueing…" : "Queue for auto-apply"}
            </Button>
          )}
          {canOverrideRules && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setOverrideConfirmOpen(true)}
              disabled={overrideLoading}
            >
              {overrideLoading ? "Sending…" : "Override rules and queue"}
            </Button>
          )}
          {overrideConfirmOpen && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
              onClick={() => setOverrideConfirmOpen(false)}
            >
              <div
                className="ds-card max-w-sm p-5 shadow-soft"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-ds-body text-slate-200">
                  Are you sure you want to override rules and send this job to auto-apply?
                </p>
                <div className="mt-4 flex gap-2">
                  <Button type="button" variant="primary" size="md" onClick={handleOverrideRulesAndQueue}>
                    Yes, send to queue
                  </Button>
                  <Button type="button" variant="secondary" size="md" onClick={() => setOverrideConfirmOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
          {isQueued && (
            <span className="inline-flex items-center rounded-ds-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-400">
              In auto-apply queue
            </span>
          )}
          <Button type="button" variant="primary" size="md" onClick={() => handleStatus("applied")}>
            Mark applied
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={() => handleStatus("saved")}>
            Save job
          </Button>
          <Button type="button" variant="danger" size="md" onClick={() => handleStatus("rejected")}>
            Mark rejected
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {getValidJobUrl(job) ? (
            <Link
              href={getValidJobUrl(job)!}
              target="_blank"
              rel="noopener noreferrer"
              className="ds-btn-primary-md"
            >
              Open Original Posting
            </Link>
          ) : (
            <span
              className="ds-btn-primary-md cursor-not-allowed opacity-60 !bg-slate-700 !text-slate-400"
              title="Original link unavailable"
            >
              Original link unavailable
            </span>
          )}
          <Link href={`/jobs/${id}`} className="ds-btn-secondary-md">
            Full details
          </Link>
        </div>
      </div>
    </div>
  );
}
