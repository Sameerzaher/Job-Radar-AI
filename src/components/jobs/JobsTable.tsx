import Link from "next/link";
import type { IJob } from "@/models/Job";

type JobWithScore = IJob & {
  score: number;
  reasons: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
};

function jobLink(job: JobWithScore): string {
  return (job as IJob & { url?: string; externalUrl?: string }).url
    ?? (job as IJob & { url?: string; externalUrl?: string }).externalUrl
    ?? "#";
}

type JobsTableProps = {
  jobs: JobWithScore[];
  onJobSelect?: (job: JobWithScore) => void;
};

export function JobsTable({ jobs, onJobSelect }: JobsTableProps) {
  if (!jobs.length) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-slate-400">
        <p>No jobs in your radar yet.</p>
        <p className="max-w-md text-xs text-slate-500">
          Seed the database or connect a job source to see how matches are
          scored against your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="hidden md:block">
        <table className="min-w-full divide-y divide-slate-800/80 text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {jobs.map((job) => (
              <tr
                key={job._id.toString()}
                className={`hover:bg-slate-900/60 ${onJobSelect ? "cursor-pointer" : ""}`}
                onClick={onJobSelect ? () => onJobSelect(job) : undefined}
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-100">
                  {onJobSelect ? (
                    <button
                      type="button"
                      className="text-left hover:text-accent hover:underline"
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
                      className="hover:text-accent hover:underline"
                    >
                      {job.title}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  {job.company}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {job.location}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {job.source}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    {job.score}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs capitalize text-slate-300">
                  {job.status}
                </td>
                <td className="px-4 py-3 text-right text-xs" onClick={(e) => e.stopPropagation()}>
                  {onJobSelect ? (
                    <>
                      <button
                        type="button"
                        className="mr-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                        onClick={() => onJobSelect(job)}
                      >
                        Details
                      </button>
                      <Link
                        href={jobLink(job)}
                        target="_blank"
                        className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                      >
                        View
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/jobs/${job._id.toString()}`}
                        className="mr-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                      >
                        Details
                      </Link>
                      <Link
                        href={jobLink(job)}
                        target="_blank"
                        className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                      >
                        View
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {jobs.map((job) => (
          <div
            key={job._id.toString()}
            className={`rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 ${onJobSelect ? "cursor-pointer" : ""}`}
            onClick={onJobSelect ? () => onJobSelect(job) : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                {onJobSelect ? (
                  <button
                    type="button"
                    className="text-left text-sm font-medium text-slate-100 hover:text-accent hover:underline"
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
                    className="text-sm font-medium text-slate-100 hover:text-accent hover:underline"
                  >
                    {job.title}
                  </Link>
                )}
                <p className="mt-0.5 text-xs text-slate-400">
                  {job.company} · {job.location}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                {job.score}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{job.source}</span>
              <span className="capitalize">{job.status}</span>
            </div>
            <div className="mt-3 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              {onJobSelect ? (
                <>
                  <button
                    type="button"
                    className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                    onClick={() => onJobSelect(job)}
                  >
                    Details
                  </button>
                  <Link
                    href={jobLink(job)}
                    target="_blank"
                    className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                  >
                    View role
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/jobs/${job._id.toString()}`}
                    className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                  >
                    Details
                  </Link>
                  <Link
                    href={jobLink(job)}
                    target="_blank"
                    className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-accent hover:text-white"
                  >
                    View role
                  </Link>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

