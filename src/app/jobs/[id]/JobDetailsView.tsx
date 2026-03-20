"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { IJob } from "@/models/Job";
import type { IMatch } from "@/models/Match";
import type { JobStatus } from "@/models/Job";
import type { MatchScore } from "@/services/scoring";

type JobSerialized = Omit<IJob, "createdAt" | "updatedAt"> & {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
};

type MatchSerialized = Omit<IMatch, "createdAt" | "updatedAt"> & {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  tailoredUsedInApply?: boolean;
};

type JobDetailsViewProps = {
  jobId: string;
  job: JobSerialized;
  match: MatchSerialized | null;
  scoreResult: MatchScore;
  jobLinkUrl: string | null;
  hasValidJobLink: boolean;
  openAIAvailable: boolean;
  analyzeAction: (jobId: string) => Promise<void>;
  tailorResumeAction: (jobId: string) => Promise<void>;
  hasResume: boolean;
  updateStatusAction: (jobId: string, status: JobStatus) => Promise<void>;
  applyProfileSelection?: { selectedProfileName: string; reasons: string[]; useUserFallback: boolean } | null;
  applyProfiles?: { _id: string; name: string }[];
  matchId?: string | null;
  selectedApplyProfileId?: unknown;
  setSelectedApplyProfileAction?: (matchId: string, applyProfileId: string | null) => Promise<void>;
  /** Company application history for this job's company (optional). */
  companyMemory?: {
    displayCompanyName: string;
    lastAppliedAt: string | null;
    lastAppliedRole: string;
    lastOutcome: string | null;
    totalApplications: number;
    totalApplied: number;
    totalFailed: number;
    totalNeedsReview: number;
    lastApplyProfileName: string;
  } | null;
};

const RECOMMENDATION_STYLE: Record<string, { bg: string; label: string }> = {
  apply: { bg: "bg-emerald-500/20 text-emerald-400", label: "Apply" },
  maybe: { bg: "bg-amber-500/20 text-amber-400", label: "Maybe" },
  skip: { bg: "bg-slate-500/20 text-slate-400", label: "Skip" }
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  new: "New",
  queued: "Queued",
  ready_for_review: "Ready for review",
  approved: "Approved",
  applying: "Applying",
  applied: "Applied",
  failed: "Failed",
  needs_review: "Needs review",
  rejected: "Rejected",
  skipped_rules: "Skipped (rules)",
  skipped_unsupported: "Skipped (unsupported)"
};

const DESCRIPTION_TRUNCATE_LEN = 1200;

function getScoreStyle(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) return { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "High match" };
  if (score >= 50) return { bg: "bg-amber-500/20", text: "text-amber-400", label: "Medium match" };
  return { bg: "bg-slate-500/20", text: "text-slate-400", label: "Low match" };
}

export function JobDetailsView({
  jobId,
  job,
  match,
  scoreResult,
  jobLinkUrl,
  hasValidJobLink,
  openAIAvailable,
  analyzeAction,
  tailorResumeAction,
  hasResume,
  updateStatusAction,
  applyProfileSelection,
  applyProfiles = [],
  matchId,
  selectedApplyProfileId,
  setSelectedApplyProfileAction,
  companyMemory
}: JobDetailsViewProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [profileSelectBusy, setProfileSelectBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const jobStatus = (job as { status?: string }).status ?? "new";
  const appStatus = match?.applicationStatus ?? "new";
  const appliedAt = match?.appliedAt
    ? typeof match.appliedAt === "string"
      ? new Date(match.appliedAt)
      : (match.appliedAt as Date)
    : null;
  const failureReason = (match as { failureReason?: string | null }).failureReason ?? null;
  const showReviewLink =
    appStatus === "ready_for_review" || appStatus === "needs_review" || appStatus === "failed";
  const description = job.description ?? "";
  const isLongDescription = description.length > DESCRIPTION_TRUNCATE_LEN;
  const descriptionToShow =
    isLongDescription && !descriptionExpanded
      ? description.slice(0, DESCRIPTION_TRUNCATE_LEN) + "…"
      : description;
  const jobTags = (job as { tags?: string[] }).tags ?? [];

  const hasAIAnalysis = match?.aiSummary != null && match.aiSummary.length > 0;
  const recStyle = match?.recommendation
    ? RECOMMENDATION_STYLE[match.recommendation] ?? RECOMMENDATION_STYLE.maybe
    : null;
  const scoreStyle = getScoreStyle(scoreResult.score);

  async function handleAnalyze() {
    setError(null);
    setAnalyzing(true);
    try {
      await analyzeAction(jobId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleStatus(status: JobStatus) {
    setError(null);
    setUpdating(true);
    try {
      await updateStatusAction(jobId, status);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  async function handleTailor() {
    setError(null);
    setTailoring(true);
    try {
      await tailorResumeAction(jobId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tailoring failed");
    } finally {
      setTailoring(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm">
        <Link href="/jobs" className="text-slate-400 hover:text-white">
          ← Jobs
        </Link>
      </nav>

      {/* Header: title, company, location, score */}
      <header className="glass-panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-2 text-lg text-slate-300">
              {job.company}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {job.location}
            </p>
            {job.source && (
              <p className="mt-1 text-xs text-slate-500">Source: {job.source}</p>
            )}
            {hasValidJobLink && jobLinkUrl && (
              <p className="mt-1 text-xs text-slate-500 break-all">
                Original posting: <span className="text-slate-400">{jobLinkUrl}</span>
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${scoreStyle.bg} ${scoreStyle.text}`}
              title={scoreStyle.label}
            >
              <span aria-hidden className="text-lg">
                {scoreResult.score}
              </span>
              <span className="text-xs font-medium opacity-90">/ 100</span>
            </span>
            {recStyle && (
              <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${recStyle.bg}`}>
                {recStyle.label}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-800/80 pt-6">
          {hasValidJobLink && jobLinkUrl ? (
            <Link
              href={jobLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-soft"
            >
              Open Original Posting
            </Link>
          ) : (
            <span
              className="inline-flex cursor-not-allowed items-center rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-500"
              title="Original link unavailable"
            >
              Original link unavailable
            </span>
          )}
          <button
            type="button"
            onClick={() => handleStatus("applied")}
            disabled={updating}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Mark applied
          </button>
          <button
            type="button"
            onClick={() => handleStatus("saved")}
            disabled={updating}
            className="inline-flex items-center rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700/60 disabled:opacity-60"
          >
            Save job
          </button>
          <button
            type="button"
            onClick={() => handleStatus("rejected")}
            disabled={updating}
            className="inline-flex items-center rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-red-800/60 hover:bg-red-900/20 hover:text-red-300 disabled:opacity-60"
          >
            Mark rejected
          </button>
        </div>
        {match?.status === "applied" && (
          <p className="mt-3 text-sm text-slate-400">
            {match.tailoredUsedInApply
              ? "This application used a tailored cover letter from Tailored applications."
              : "This application used the default cover letter."}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </header>

      {/* Apply profile */}
      {applyProfileSelection && matchId && (
        <section className="glass-panel p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
            Apply profile
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Selected: <strong>{applyProfileSelection.selectedProfileName}</strong>
            {applyProfileSelection.useUserFallback && " (user profile – no apply profiles defined)"}
          </p>
          {applyProfileSelection.reasons.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">Reasons: {applyProfileSelection.reasons.join("; ")}</p>
          )}
          {applyProfiles.length > 0 && setSelectedApplyProfileAction && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500">Override:</label>
              <select
                className="rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-sm text-slate-200"
                value={selectedApplyProfileId ? String(selectedApplyProfileId) : ""}
                disabled={profileSelectBusy}
                onChange={async (e) => {
                  const v = e.target.value;
                  setProfileSelectBusy(true);
                  try {
                    await setSelectedApplyProfileAction(matchId, v || null);
                    router.refresh();
                  } finally {
                    setProfileSelectBusy(false);
                  }
                }}
              >
                <option value="">Auto (recommended)</option>
                {applyProfiles.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </section>
      )}

      {/* Status & application */}
      <section className="glass-panel p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
          Status & application
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Job status</p>
            <p className="mt-1 text-sm capitalize text-slate-200">{jobStatus}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Application status</p>
            <p className="mt-1 text-sm text-slate-200">
              {APPLICATION_STATUS_LABELS[appStatus] ?? appStatus}
            </p>
          </div>
          {appliedAt && (
            <div>
              <p className="text-xs font-medium text-slate-500">Applied at</p>
              <p className="mt-1 text-sm text-slate-200">
                {appliedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          )}
          {failureReason && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-500">Failure reason</p>
              <p className="mt-1 text-sm text-amber-300">{failureReason}</p>
            </div>
          )}
        </div>
        {showReviewLink && (
          <div className="mt-4">
            <Link
              href="/review"
              className="inline-flex items-center rounded-xl border border-amber-600/60 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20"
            >
              Review this job →
            </Link>
          </div>
        )}
      </section>

      {/* Company Memory */}
      {companyMemory && (
        <section className="glass-panel p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
            Company application history
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Prior applications at {companyMemory.displayCompanyName}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {companyMemory.lastAppliedAt && (
              <div>
                <p className="text-xs font-medium text-slate-500">Last applied</p>
                <p className="mt-1 text-sm text-slate-200">
                  {new Date(companyMemory.lastAppliedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </p>
              </div>
            )}
            {companyMemory.lastAppliedRole && (
              <div>
                <p className="text-xs font-medium text-slate-500">Last role</p>
                <p className="mt-1 text-sm text-slate-200">{companyMemory.lastAppliedRole}</p>
              </div>
            )}
            {companyMemory.lastOutcome && (
              <div>
                <p className="text-xs font-medium text-slate-500">Last outcome</p>
                <p className="mt-1 text-sm text-slate-200">
                  {APPLICATION_STATUS_LABELS[companyMemory.lastOutcome] ?? companyMemory.lastOutcome}
                </p>
              </div>
            )}
            {companyMemory.lastApplyProfileName && (
              <div>
                <p className="text-xs font-medium text-slate-500">Profile used</p>
                <p className="mt-1 text-sm text-slate-200">{companyMemory.lastApplyProfileName}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-slate-500">Total applications (all outcomes)</p>
              <p className="mt-1 text-sm text-slate-200">{companyMemory.totalApplications}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Applied / Failed / Needs review</p>
              <p className="mt-1 text-sm text-slate-200">
                {companyMemory.totalApplied} / {companyMemory.totalFailed} / {companyMemory.totalNeedsReview}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Description */}
      <section className="glass-panel p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
          Description
        </h2>
        {jobTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {jobTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-600 bg-slate-800/60 px-2.5 py-0.5 text-xs text-slate-300"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 text-slate-300">
          {description ? (
            <>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {descriptionToShow}
              </div>
              {isLongDescription && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((e) => !e)}
                  className="mt-2 text-sm font-medium text-accent hover:underline"
                >
                  {descriptionExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">No description available.</p>
          )}
        </div>
      </section>

      {/* Skills: matched + missing */}
      <section className="glass-panel p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
          Skills fit
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-emerald-400/90">Matched skills</p>
            <p className="mt-1.5 text-sm text-slate-300">
              {(scoreResult.matchedSkills?.length ?? 0) > 0
                ? scoreResult.matchedSkills!.join(", ")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-amber-400/90">Missing skills</p>
            <p className="mt-1.5 text-sm text-slate-300">
              {(scoreResult.missingSkills?.length ?? 0) > 0
                ? scoreResult.missingSkills!.join(", ")
                : "—"}
            </p>
          </div>
        </div>
        {scoreResult.reasons.length > 0 && (
          <div className="mt-4 border-t border-slate-800/80 pt-4">
            <p className="text-xs font-medium text-slate-500">Match reasons</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
              {scoreResult.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* AI summary */}
      <section className="glass-panel p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
          AI summary
        </h2>
        {hasAIAnalysis && match ? (
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Summary</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                {match.aiSummary}
              </p>
            </div>
            {match.whyItMatches && (
              <div>
                <p className="text-xs font-medium text-slate-500">Why it matches you</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                  {match.whyItMatches}
                </p>
              </div>
            )}
            {(match.aiMissingSkills?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500">Missing skills (AI)</p>
                <p className="mt-1.5 text-sm text-slate-200">
                  {match.aiMissingSkills!.join(", ")}
                </p>
              </div>
            )}
            {match.recommendation && recStyle && (
              <div>
                <p className="text-xs font-medium text-slate-500">Recommendation</p>
                <p className="mt-1.5">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${recStyle.bg}`}>
                    {recStyle.label}
                  </span>
                </p>
              </div>
            )}
          </div>
        ) : openAIAvailable ? (
          <div className="mt-4">
            <p className="text-sm text-slate-400">
              Generate an AI summary and recommendation from this job and your profile.
            </p>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-70"
            >
              {analyzing ? "Analyzing…" : "Generate AI analysis"}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Set <code className="rounded bg-slate-800 px-1.5 py-0.5">OPENAI_API_KEY</code> in .env to enable AI analysis.
          </p>
        )}
      </section>

      {/* Resume tailoring */}
      <section className="glass-panel p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">
          AI resume tailoring
        </h2>
        {match?.tailoredResumeSummary || (match?.tailoredBulletPoints?.length ?? 0) > 0 || match?.tailoredCoverLetter ? (
          <div className="mt-4 space-y-5">
            {match.tailoredResumeSummary && (
              <div>
                <p className="text-xs font-medium text-slate-500">Tailored resume summary</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                  {match.tailoredResumeSummary}
                </p>
              </div>
            )}
            {(match.tailoredBulletPoints?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500">Suggested bullet points</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-200">
                  {match.tailoredBulletPoints!.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            {match.tailoredCoverLetter && (
              <div>
                <p className="text-xs font-medium text-slate-500">Cover letter draft</p>
                <div className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                  {match.tailoredCoverLetter}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleTailor}
              disabled={tailoring}
              className="mt-2 rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-60"
            >
              {tailoring ? "Refreshing tailoring…" : "Refresh tailoring"}
            </button>
          </div>
        ) : openAIAvailable ? (
          hasResume ? (
            <div className="mt-4">
              <p className="text-sm text-slate-400">
                Use your saved resume to generate tailored bullet points and a cover letter for this job.
              </p>
              <button
                type="button"
                onClick={handleTailor}
                disabled={tailoring}
                className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-70"
              >
                {tailoring ? "Tailoring…" : "Tailor resume & cover letter"}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Add your resume text in the{" "}
              <Link href="/profile" className="text-accent hover:underline">
                Profile
              </Link>{" "}
              page to enable AI resume tailoring.
            </p>
          )
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Set <code className="rounded bg-slate-800 px-1.5 py-0.5">OPENAI_API_KEY</code> in .env to enable AI tailoring.
          </p>
        )}
      </section>
    </div>
  );
}
