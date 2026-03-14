/**
 * Ensures only supported apply URLs can enter queued/approved status.
 * Use before setting applicationStatus to "queued" or "approved".
 * Automatic queueing (ingestion, backfill) only sets queued for Greenhouse + autoApplySupported.
 */

import { getApplicationStatusFromScore } from "@/config/applyConfig";
import { classifyProviderUrl } from "./providerUrlClassifier";
import { getValidJobUrl } from "@/lib/urlValidation";

const LOG = "[JobRadar] Queue:";

export interface ResolveQueueStatusResult {
  applicationStatus: string;
  failureReason: string | null;
  /** When blocked: classification that caused skip (for logging). */
  classification?: string;
  hostname?: string | null;
}

/**
 * Resolve the application status to set when the "intended" status is queued or approved.
 * If job has autoApplySupported=false (e.g. generic careers page), returns ready_for_review so it stays discoverable.
 * If intended is queued/approved and the job URL is not a supported apply URL,
 * returns skipped_unsupported so the job never enters the auto-apply queue.
 */
export function resolveQueueStatusByUrl(
  job: { source: string; url?: string; externalUrl?: string; autoApplySupported?: boolean },
  intendedStatus: string
): ResolveQueueStatusResult {
  if (intendedStatus !== "queued" && intendedStatus !== "approved") {
    return { applicationStatus: intendedStatus, failureReason: null };
  }

  if (job.autoApplySupported === false) {
    return {
      applicationStatus: "ready_for_review",
      failureReason: null,
      classification: "generic_careers_page_or_unsupported"
    };
  }

  const url = getValidJobUrl(job);
  const result = classifyProviderUrl(job.source, url ?? undefined);

  if (result.classification === "supported_apply_url") {
    return { applicationStatus: intendedStatus, failureReason: null };
  }

  return {
    applicationStatus: "skipped_unsupported",
    failureReason: "Unsupported careers page URL for auto-apply",
    classification: result.classification,
    hostname: result.hostname
  };
}

/**
 * Intended application status for automatic queueing (ingestion, backfill).
 * Only Greenhouse jobs with autoApplySupported=true get "queued"; others with score >= threshold get "ready_for_review".
 */
export function getAutoQueueIntendedStatus(
  job: { source: string; autoApplySupported?: boolean },
  score: number
): "queued" | "ready_for_review" | "new" {
  const status = getApplicationStatusFromScore(score);
  if (status !== "queued") return status;
  if (job.source === "Greenhouse" && job.autoApplySupported === true) return "queued";
  return "ready_for_review";
}

/**
 * Log when a job is blocked from the queue due to unsupported URL.
 */
export function logJobBlockedBeforeQueue(
  title: string,
  company: string,
  source: string,
  classification: string,
  hostname: string | null
): void {
  console.log(
    `${LOG} job blocked before queue because URL unsupported | title=${title} company=${company} source=${source} hostname=${hostname ?? "—"} classification=${classification}`
  );
}
