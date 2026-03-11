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

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await getOrCreateDefaultUser();
  const items = await getReviewQueueItems(user);

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Review queue"
        description="Jobs in ready_for_review, needs_review, or failed. Approve to queue for auto-apply, reject to skip, or retry failed applications."
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
