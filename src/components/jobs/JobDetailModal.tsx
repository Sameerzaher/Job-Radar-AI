"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JobWithScore } from "@/services/jobService";
import type { JobStatus } from "@/models/Job";

function jobLink(job: JobWithScore): string {
  return job.url ?? job.externalUrl ?? "#";
}

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">{job.title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {job.company} · {job.location}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Score: {job.score}
              </span>
              <span className="text-xs capitalize text-slate-500">
                {job.status}
              </span>
              {job.source && (
                <span className="text-xs text-slate-500">{job.source}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {job.reasons?.length > 0 && (
          <div className="mt-4 border-t border-slate-800/80 pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Match reasons
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">
              {job.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {(job.matchedSkills?.length ?? 0) > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500">Matched skills</p>
            <p className="mt-0.5 text-sm text-slate-300">
              {job.matchedSkills!.join(", ")}
            </p>
          </div>
        )}

        {(job.missingSkills?.length ?? 0) > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500">Missing skills</p>
            <p className="mt-0.5 text-sm text-slate-300">
              {job.missingSkills!.join(", ")}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800/80 pt-5">
          <button
            type="button"
            onClick={() => handleStatus("applied")}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Mark applied
          </button>
          <button
            type="button"
            onClick={() => handleStatus("saved")}
            className="rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/60"
          >
            Save job
          </button>
          <button
            type="button"
            onClick={() => handleStatus("rejected")}
            className="rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-red-900/30 hover:text-red-300"
          >
            Mark rejected
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={jobLink(job)}
            target="_blank"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft"
          >
            Open job link
          </Link>
          <Link
            href={`/jobs/${id}`}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60"
          >
            Full details
          </Link>
        </div>
      </div>
    </div>
  );
}
