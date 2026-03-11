"use client";

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

export function JobDetailModal({
  job,
  onClose,
  updateStatusAction
}: JobDetailModalProps) {
  const router = useRouter();
  const id = job._id.toString();

  async function handleStatus(status: JobStatus) {
    await updateStatusAction(id, status);
    router.refresh();
    onClose();
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
              {job.source && (
                <Badge variant="neutral">{job.source}</Badge>
              )}
            </div>
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
