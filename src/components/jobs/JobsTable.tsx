import Link from "next/link";
import type { IJob } from "@/models/Job";
import { getValidJobUrl } from "@/lib/urlValidation";
import {
  EmptyState,
  TableRoot,
  TableHead,
  TableBody,
  TableHeaderRow,
  TableHeaderCell,
  TableRow,
  TableCell,
  Badge,
  ScoreBadge,
  Button
} from "@/components/ui";

type JobWithScore = IJob & {
  score: number;
  reasons: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  matchId?: string;
  applicationStatus?: string;
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

type JobsTableProps = {
  jobs: JobWithScore[];
  onJobSelect?: (job: JobWithScore) => void;
};

/** Internal = Details (outline). External = Open Job (primary when available, muted Unavailable when not). */
function JobRowActions({
  job,
  onJobSelect
}: {
  job: JobWithScore;
  onJobSelect?: (job: JobWithScore) => void;
}) {
  const detailsHref = `/jobs/${job._id.toString()}`;
  const openJobUrl = getValidJobUrl(job);
  const hasValidExternalUrl = openJobUrl != null;

  return (
    <span className="inline-flex items-center gap-2">
      {/* Internal: Details */}
      {onJobSelect ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onJobSelect(job)}
        >
          Details
        </Button>
      ) : (
        <Link
          href={detailsHref}
          className="inline-flex items-center justify-center rounded-ds-lg border border-slate-600 bg-transparent px-3 py-1.5 text-ds-caption font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Details
        </Link>
      )}
      {/* External: Open Job (only real URL) or disabled Unavailable */}
      {hasValidExternalUrl ? (
        <Link
          href={openJobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-ds-lg border border-transparent bg-slate-100 px-3 py-1.5 text-ds-caption font-medium text-slate-900 transition hover:bg-white"
        >
          Open Job
        </Link>
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-ds-lg border border-transparent bg-transparent px-3 py-1.5 text-ds-caption font-medium text-slate-500"
          aria-disabled="true"
        >
          Unavailable
        </span>
      )}
    </span>
  );
}

export function JobsTable({ jobs, onJobSelect }: JobsTableProps) {
  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs in your radar yet."
        description="Seed the database or connect a job source to see how matches are scored against your profile."
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <TableRoot>
          <TableHead>
            <TableHeaderRow>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Company</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Source</TableHeaderCell>
              <TableHeaderCell>Apply</TableHeaderCell>
              <TableHeaderCell>Score</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell align="right" />
            </TableHeaderRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow
                key={job._id.toString()}
                onClick={onJobSelect ? () => onJobSelect(job) : undefined}
                clickable={!!onJobSelect}
              >
                <TableCell>
                  {onJobSelect ? (
                    <button
                      type="button"
                      className="text-left text-ds-body font-medium text-slate-100 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJobSelect(job);
                      }}
                    >
                      {job.title}
                    </button>
                  ) : (
                    <Link
                      href={`/jobs/${job._id.toString()}`}
                      className="text-ds-body font-medium text-slate-100 hover:text-white"
                    >
                      {job.title}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-slate-300">{job.company}</TableCell>
                <TableCell className="text-slate-500">{job.location}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {(job as IJob & { autoApplySupported?: boolean }).autoApplySupported ? (
                    <Badge variant="score-high">Auto</Badge>
                  ) : (
                    <Badge variant="score-mid">Manual</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <ScoreBadge score={job.score} />
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      job.applicationStatus === "applied"
                        ? "score-high"
                        : job.applicationStatus === "queued" || job.applicationStatus === "approved"
                          ? "score-mid"
                          : job.applicationStatus === "needs_review" || job.applicationStatus === "failed"
                            ? "score-low"
                            : "status"
                    }
                  >
                    {getApplicationStatusLabel(job.applicationStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <JobRowActions job={job} onJobSelect={onJobSelect} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableRoot>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {jobs.map((job) => (
          <div
            key={job._id.toString()}
            className={`rounded-ds-xl border border-slate-800/60 bg-slate-800/20 p-4 ${onJobSelect ? "cursor-pointer" : ""}`}
            onClick={onJobSelect ? () => onJobSelect(job) : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {onJobSelect ? (
                  <button
                    type="button"
                    className="text-left text-ds-body font-medium text-slate-100 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobSelect(job);
                    }}
                  >
                    {job.title}
                  </button>
                ) : (
                  <Link
                    href={`/jobs/${job._id.toString()}`}
                    className="text-ds-body font-medium text-slate-100 hover:text-white"
                  >
                    {job.title}
                  </Link>
                )}
                <p className="mt-0.5 text-ds-caption text-slate-500">
                  {job.company} · {job.location}
                </p>
              </div>
              <ScoreBadge score={job.score} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-ds-caption">
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
              {(job as IJob & { autoApplySupported?: boolean }).autoApplySupported ? (
                <Badge variant="score-high">Auto</Badge>
              ) : (
                <Badge variant="score-mid">Manual</Badge>
              )}
              <Badge
                variant={
                  job.applicationStatus === "applied"
                    ? "score-high"
                    : job.applicationStatus === "queued" || job.applicationStatus === "approved"
                      ? "score-mid"
                      : job.applicationStatus === "needs_review" || job.applicationStatus === "failed"
                        ? "score-low"
                        : "status"
                }
              >
                {getApplicationStatusLabel(job.applicationStatus)}
              </Badge>
            </div>
            <div className="mt-3 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <JobRowActions job={job} onJobSelect={onJobSelect} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
