/**
 * Cleanup and migration: classify existing jobs by URL quality and set
 * urlClassification + autoApplySupported. Move ineligible matches out of queued/approved.
 */

import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { Match } from "@/models/Match";
import { classifyUrlQualityForIngestion } from "@/services/autoApply/providerUrlClassifier";
import { getValidJobUrl } from "@/lib/urlValidation";

const LOG = "[JobRadar] UrlQualityCleanup:";

const FAILURE_REASON = "Existing job URL not eligible for auto-apply after URL quality cleanup";

export interface UrlQualityCleanupOptions {
  /** If true, archive jobs with invalid_url instead of just marking autoApplySupported=false. */
  archiveInvalidUrlJobs?: boolean;
  /** If true, dry run: no writes, only report. */
  dryRun?: boolean;
}

export interface UrlQualityCleanupReport {
  totalJobsChecked: number;
  jobsUpdated: number;
  supported_apply_url: number;
  generic_careers_page: number;
  unsupported_custom_careers_page: number;
  invalid_url: number;
  /** Total jobs with autoApplySupported=true after cleanup */
  autoApplySupportedTrue: number;
  /** Total jobs with autoApplySupported=false after cleanup */
  autoApplySupportedFalse: number;
  matchesMovedOutOfQueue: number;
  /** Same as matchesMovedOutOfQueue: matches set to skipped_unsupported */
  matchesSetToSkippedUnsupported: number;
  jobsArchived: number;
  dryRun: boolean;
}

export async function runUrlQualityCleanup(
  options: UrlQualityCleanupOptions = {}
): Promise<UrlQualityCleanupReport> {
  const { archiveInvalidUrlJobs = false, dryRun = false } = options;
  await connectToDatabase();

  const report: UrlQualityCleanupReport = {
    totalJobsChecked: 0,
    jobsUpdated: 0,
    supported_apply_url: 0,
    generic_careers_page: 0,
    unsupported_custom_careers_page: 0,
    invalid_url: 0,
    autoApplySupportedTrue: 0,
    autoApplySupportedFalse: 0,
    matchesMovedOutOfQueue: 0,
    matchesSetToSkippedUnsupported: 0,
    jobsArchived: 0,
    dryRun
  };

  const jobs = await Job.find({}).lean();
  report.totalJobsChecked = jobs.length;

  console.log(`${LOG} cleanup started | jobs=${report.totalJobsChecked} dryRun=${dryRun}`);

  for (const job of jobs) {
    const source = job.source ?? "";
    const url = job.url ?? job.externalUrl ?? null;
    const urlToUse = getValidJobUrl({ url, externalUrl: job.externalUrl }) ?? url ?? undefined;
    const result = classifyUrlQualityForIngestion(source, urlToUse ?? null);

    const classification = result.classification;
    if (classification === "supported_apply_url") report.supported_apply_url += 1;
    else if (classification === "generic_careers_page") report.generic_careers_page += 1;
    else if (classification === "unsupported_custom_careers_page") report.unsupported_custom_careers_page += 1;
    else report.invalid_url += 1;

    const currentClassification = (job as { urlClassification?: string }).urlClassification;
    const currentAutoApply = (job as { autoApplySupported?: boolean }).autoApplySupported;
    const needsUpdate =
      currentClassification !== classification ||
      currentAutoApply !== result.autoApplySupported;

    if (needsUpdate) {
      if (!dryRun) {
        const update: Record<string, unknown> = {
          urlClassification: classification,
          autoApplySupported: result.autoApplySupported
        };
        if (archiveInvalidUrlJobs && classification === "invalid_url") {
          update.status = "archived";
          report.jobsArchived += 1;
        }
        await Job.updateOne({ _id: job._id }, { $set: update });
      }
      report.jobsUpdated += 1;
    }
  }

  report.autoApplySupportedTrue = report.supported_apply_url;
  report.autoApplySupportedFalse =
    report.generic_careers_page + report.unsupported_custom_careers_page + report.invalid_url;

  if (report.jobsUpdated > 0) {
    console.log(`${LOG} job reclassified | count=${report.jobsUpdated}`);
  }

  const matchIdsToUpdate = await Match.aggregate<{ _id: unknown }>([
    { $match: { applicationStatus: { $in: ["queued", "approved"] } } },
    { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "jobDoc" } },
    { $unwind: "$jobDoc" },
    {
      $match: {
        $or: [
          { "jobDoc.autoApplySupported": false },
          { "jobDoc.autoApplySupported": { $exists: false } }
        ]
      }
    },
    { $project: { _id: 1 } }
  ]);

  const ids = matchIdsToUpdate.map((m) => m._id);
  if (ids.length > 0 && !dryRun) {
    const res = await Match.updateMany(
      { _id: { $in: ids } },
      { $set: { applicationStatus: "skipped_unsupported", failureReason: FAILURE_REASON } }
    );
    const count = res.modifiedCount ?? ids.length;
    report.matchesMovedOutOfQueue = count;
    report.matchesSetToSkippedUnsupported = count;
    console.log(
      `${LOG} match reclassified | count=${count} applicationStatus=skipped_unsupported failureReason="${FAILURE_REASON}"`
    );
  } else if (ids.length > 0 && dryRun) {
    report.matchesMovedOutOfQueue = ids.length;
    report.matchesSetToSkippedUnsupported = ids.length;
  }

  if (!dryRun) {
    const { getOrCreateDefaultUser } = await import("@/services/userService");
    const { autoQueueEligibleMatches } = await import("@/services/autoApply/autoQueue");
    const user = await getOrCreateDefaultUser();
    const autoQueueResult = await autoQueueEligibleMatches(user);
    if (autoQueueResult.queued > 0) {
      console.log(`${LOG} auto-queue after cleanup | queued=${autoQueueResult.queued}`);
    }
  }

  console.log(
    `${LOG} cleanup completed with summary | totalJobsChecked=${report.totalJobsChecked} jobsUpdated=${report.jobsUpdated} ` +
      `supported_apply_url=${report.supported_apply_url} generic_careers_page=${report.generic_careers_page} ` +
      `unsupported_custom_careers_page=${report.unsupported_custom_careers_page} invalid_url=${report.invalid_url} ` +
      `autoApplySupportedTrue=${report.autoApplySupportedTrue} autoApplySupportedFalse=${report.autoApplySupportedFalse} ` +
      `matchesMovedOutOfQueue=${report.matchesMovedOutOfQueue} matchesSetToSkippedUnsupported=${report.matchesSetToSkippedUnsupported} jobsArchived=${report.jobsArchived} dryRun=${report.dryRun}`
  );

  return report;
}
