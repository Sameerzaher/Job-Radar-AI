import { getOrCreateDefaultUser } from "@/services/userService";
import {
  getReviewQueueItems,
  approveMatch,
  rejectMatch,
  retryMatch,
  type ReviewQueueItem
} from "@/services/jobService";
import { PageHeader } from "@/components/ui";
import { ReviewQueueList } from "@/components/review/ReviewQueueList";
import { ReviewQueueFilters } from "@/components/review/ReviewQueueFilters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; reason?: string; provider?: string; company?: string; autoApply?: string }>;

export default async function ReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getOrCreateDefaultUser();
  const params = await searchParams;
  const statuses = params.status ? params.status.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const autoApplySupported =
    params.autoApply === "true" ? true : params.autoApply === "false" ? false : undefined;
  const items = await getReviewQueueItems(user, {
    applicationStatus: statuses,
    failureReason: params.reason,
    provider: params.provider,
    company: params.company,
    autoApplySupported
  });

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Review queue"
        description="Jobs in ready_for_review, needs_review, failed, or skipped (rules/URL). Only jobs with supported apply URLs (Greenhouse, Lever, Workable official hosts) can enter the auto-apply queue. Unsupported or custom career page URLs appear under Unsupported URL and are not mixed with auto-apply–ready jobs."
      />
      <ReviewQueueFilters
        currentStatus={params.status}
        currentReason={params.reason}
        currentProvider={params.provider}
        currentCompany={params.company}
        currentAutoApply={params.autoApply}
      />
      <ReviewQueueList
        items={items}
        approveAction={async (matchId) => {
          "use server";
          await approveMatch(matchId, user);
        }}
        rejectAction={async (matchId) => {
          "use server";
          await rejectMatch(matchId, user);
        }}
        retryAction={async (matchId) => {
          "use server";
          await retryMatch(matchId, user);
        }}
      />
    </div>
  );
}
