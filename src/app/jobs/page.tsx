import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import {
  getJobsWithScores,
  getDistinctFilters,
  updateJobStatus,
  type JobWithScore
} from "@/services/jobService";
import type { JobStatus } from "@/models/Job";
import { JobsTableWithModal } from "@/components/jobs/JobsTableWithModal";
import { JobsFilters } from "@/components/jobs/JobsFilters";

export const dynamic = "force-dynamic";

async function updateJobStatusAction(jobId: string, status: JobStatus) {
  "use server";
  await updateJobStatus(jobId, status);
  revalidatePath("/jobs");
}

type SearchParams = { [key: string]: string | string[] | undefined };

function parseFilters(searchParams: SearchParams) {
  const minScoreParam = searchParams.minScore;
  const minScore =
    typeof minScoreParam === "string" && minScoreParam !== ""
      ? parseInt(minScoreParam, 10)
      : undefined;
  const source =
    typeof searchParams.source === "string" && searchParams.source !== ""
      ? searchParams.source
      : undefined;
  const status =
    typeof searchParams.status === "string" && searchParams.status !== ""
      ? searchParams.status
      : undefined;
  const location =
    typeof searchParams.location === "string" && searchParams.location !== ""
      ? searchParams.location
      : undefined;
  const sortBy =
    typeof searchParams.sortBy === "string" && searchParams.sortBy !== ""
      ? searchParams.sortBy
      : undefined;
  const validSort =
    sortBy === "score-desc" || sortBy === "score-asc" || sortBy === "newest"
      ? sortBy
      : undefined;
  return {
    minScore: Number.isFinite(minScore) ? minScore : undefined,
    source,
    status,
    location,
    sortBy: validSort
  };
}

export default async function JobsPage({
  searchParams = {}
}: {
  searchParams?: SearchParams;
}) {
  const user = await getOrCreateDefaultUser();
  const filters = parseFilters(searchParams);
  const [jobs, { sources }] = await Promise.all([
    getJobsWithScores(user, filters),
    getDistinctFilters()
  ]);

  const initialMinScore =
    typeof searchParams.minScore === "string" ? searchParams.minScore : "";
  const initialSource =
    typeof searchParams.source === "string" ? searchParams.source : "";
  const initialStatus =
    typeof searchParams.status === "string" ? searchParams.status : "";
  const initialLocation =
    typeof searchParams.location === "string" ? searchParams.location : "";
  const initialSortBy =
    typeof searchParams.sortBy === "string" ? searchParams.sortBy : "score-desc";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Jobs radar
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Filter by score, location, source, and status. Sort by score or date. Click a job for details and quick actions.
          </p>
        </div>
      </div>

      <JobsFilters
        sources={sources}
        initialMinScore={initialMinScore}
        initialSource={initialSource}
        initialStatus={initialStatus}
        initialLocation={initialLocation}
        initialSortBy={initialSortBy}
      />

      <JobsTableWithModal
        jobs={jobs as JobWithScore[]}
        updateStatusAction={updateJobStatusAction}
      />
    </div>
  );
}
