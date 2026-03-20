import { revalidatePath } from "next/cache";
import {
  getOrCreateDefaultUser,
  addSavedSearch,
  deleteSavedSearch
} from "@/services/userService";
import {
  getJobsWithScores,
  getDistinctFilters,
  updateJobStatus,
  type JobWithScore
} from "@/services/jobService";
import type { JobStatus } from "@/models/Job";
import { JobsTableWithModal } from "@/components/jobs/JobsTableWithModal";
import { JobsFilters } from "@/components/jobs/JobsFilters";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

async function updateJobStatusAction(jobId: string, status: JobStatus) {
  "use server";
  await updateJobStatus(jobId, status);
  revalidatePath("/jobs");
}

async function saveSearchAction(name: string, filters: Record<string, string | number | boolean>) {
  "use server";
  await addSavedSearch(name, filters);
  revalidatePath("/jobs");
}

async function deleteSearchAction(searchId: string) {
  "use server";
  await deleteSavedSearch(searchId);
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
  const autoApply =
    typeof searchParams.autoApply === "string" && searchParams.autoApply !== ""
      ? searchParams.autoApply
      : undefined;
  const autoApplySupported =
    autoApply === "true" ? true : autoApply === "false" ? false : undefined;
  const remoteOnly =
    typeof searchParams.remoteOnly === "string" && searchParams.remoteOnly === "true";
  const seniorityParam =
    typeof searchParams.seniority === "string" && searchParams.seniority !== ""
      ? searchParams.seniority
      : undefined;
  const seniority =
    seniorityParam === "junior" || seniorityParam === "mid" || seniorityParam === "senior"
      ? seniorityParam
      : undefined;
  const companyMemoryParam =
    typeof searchParams.companyMemory === "string" && searchParams.companyMemory !== ""
      ? searchParams.companyMemory
      : undefined;
  const companyMemoryFilter =
    companyMemoryParam === "has_prior" || companyMemoryParam === "never_applied" || companyMemoryParam === "on_cooldown"
      ? companyMemoryParam
      : undefined;
  return {
    minScore: Number.isFinite(minScore) ? minScore : undefined,
    source,
    status,
    location,
    sortBy: validSort,
    autoApplySupported,
    remoteSupport: remoteOnly ? true : undefined,
    seniority,
    companyMemoryFilter
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
  const initialAutoApply =
    typeof searchParams.autoApply === "string" ? searchParams.autoApply : "";
  const initialRemoteOnly =
    typeof searchParams.remoteOnly === "string" && searchParams.remoteOnly === "true";
  const initialSeniority =
    typeof searchParams.seniority === "string" ? searchParams.seniority : "";
  const initialCompanyMemory =
    typeof searchParams.companyMemory === "string" ? searchParams.companyMemory : "";

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Jobs"
        description="Filter by score, location, source, status, and apply type. Jobs with “Manual” apply are visible for discovery and manual review but are not eligible for the auto-apply queue; only “Auto” jobs use supported apply URLs (Greenhouse, Lever, Workable)."
      />

      <JobsFilters
        key={`${initialMinScore}-${initialSource}-${initialStatus}-${initialLocation}-${initialSortBy}-${initialAutoApply}-${initialRemoteOnly}-${initialSeniority}-${initialCompanyMemory}`}
        sources={sources}
        initialAutoApply={initialAutoApply}
        initialMinScore={initialMinScore}
        initialSource={initialSource}
        initialStatus={initialStatus}
        initialLocation={initialLocation}
        initialSortBy={initialSortBy}
        initialRemoteOnly={initialRemoteOnly}
        initialSeniority={initialSeniority}
        initialCompanyMemory={initialCompanyMemory}
        savedSearches={(user.savedSearches ?? []).map((s) => ({
          _id: (s as { _id?: unknown })._id != null ? String((s as { _id: unknown })._id) : undefined,
          name: s.name,
          filters: (s.filters ?? {}) as Record<string, string | number | boolean>
        }))}
        saveSearchAction={saveSearchAction}
        deleteSearchAction={deleteSearchAction}
      />

      <JobsTableWithModal
        jobs={jobs as JobWithScore[]}
        updateStatusAction={updateJobStatusAction}
      />
    </div>
  );
}
