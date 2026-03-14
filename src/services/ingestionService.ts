import { connectToDatabase } from "@/lib/db";
import { getValidJobUrl, isValidJobUrl } from "@/lib/urlValidation";
import { Job, type IJob } from "@/models/Job";
import { Match } from "@/models/Match";
import type { IUser } from "@/models/User";
import { resolveQueueStatusByUrl, logJobBlockedBeforeQueue, getAutoQueueIntendedStatus } from "@/services/autoApply/queueEligibility";
import { evaluateJobForAutoApply } from "@/services/rules/rulesEngine";
import { classifyUrlQualityForIngestion } from "@/services/autoApply/providerUrlClassifier";
import { scoreJobForUser } from "./scoring";
import { sendHighMatchNotification, isTelegramConfigured } from "./telegram";
import { logActivity } from "./activityLogger";
import type { IngestJobPayload } from "@/types/job";

const HIGH_MATCH_SCORE_THRESHOLD = 80;

export interface IngestResult {
  inserted: number;
  skipped: number;
  skippedInvalidUrl: number;
  insertedUrls: string[];
  errors: string[];
}

const LOG_INGEST = "[JobRadar] Ingest:";

/** Deduplicate by: hash, then source+externalId, then normalized URL (same job from multiple sources). */
async function findExistingJob(
  hash: string,
  externalId: string,
  source: string,
  url: string
): Promise<IJob | null> {
  const byHash = await Job.findOne({ hash }).lean();
  if (byHash) return byHash as IJob;
  const byExternal = await Job.findOne({ externalId, source }).lean();
  if (byExternal) return byExternal as IJob;
  const normalizedUrl = url?.trim();
  if (normalizedUrl) {
    const byUrl = await Job.findOne({ url: normalizedUrl }).lean();
    if (byUrl) return byUrl as IJob;
  }
  return null;
}

/** Return true when we should prefer the new URL (e.g. direct apply over generic). */
function isBetterUrlThan(
  newAutoApplySupported: boolean,
  existingJob: IJob & { autoApplySupported?: boolean }
): boolean {
  const existingSupported = existingJob.autoApplySupported === true;
  return newAutoApplySupported && !existingSupported;
}

export async function ingestJob(
  user: IUser,
  payload: IngestJobPayload
): Promise<{ job: IJob; match: Awaited<ReturnType<typeof Match.create>> } | null> {
  await connectToDatabase();

  if (!isValidJobUrl(payload.url)) {
    return null;
  }

  const urlQuality = classifyUrlQualityForIngestion(payload.source, payload.url);
  console.log(
    `${LOG_INGEST} URL classified during ingestion | source=${payload.source} hostname=${urlQuality.hostname ?? "—"} classification=${urlQuality.classification} autoApplySupported=${urlQuality.autoApplySupported}`
  );
  if (urlQuality.classification === "generic_careers_page") {
    console.log(`${LOG_INGEST} generic careers page detected | url=${payload.url} company=${payload.company}`);
  }
  if (urlQuality.autoApplySupported) {
    console.log(`${LOG_INGEST} direct apply URL selected | url=${payload.url}`);
  }

  const existing = await findExistingJob(payload.hash, payload.externalId, payload.source, payload.url);

  if (existing) {
    if (isBetterUrlThan(urlQuality.autoApplySupported, existing as IJob & { autoApplySupported?: boolean })) {
      await Job.updateOne(
        { _id: (existing as IJob)._id },
        {
          $set: {
            url: payload.url,
            urlClassification: urlQuality.classification,
            autoApplySupported: true
          }
        }
      );
      console.log(`${LOG_INGEST} upgraded existing job with better URL | jobId=${(existing as IJob)._id}`);
      const updatedJob = await Job.findById((existing as IJob)._id);
      if (!updatedJob) return null;
      let match = await Match.findOne({ job: updatedJob._id, user: user._id });
      if (match) {
        const intendedStatus = getAutoQueueIntendedStatus(
          { source: updatedJob.source, autoApplySupported: true },
          match.score
        );
        const resolved = resolveQueueStatusByUrl(
          { source: updatedJob.source, url: updatedJob.url, externalUrl: updatedJob.externalUrl, autoApplySupported: true },
          intendedStatus
        );
        let finalStatus = resolved.applicationStatus;
        let finalFailureReason = resolved.failureReason ?? null;
        let queuedAt: Date | null = null;
        if (resolved.applicationStatus === "queued") {
          const matchScore = (match as { score?: number }).score;
          const ruleResult = await evaluateJobForAutoApply(
            user,
            {
              _id: updatedJob._id,
              company: updatedJob.company,
              title: updatedJob.title,
              location: updatedJob.location,
              postedAt: updatedJob.postedAt,
              foundAt: updatedJob.foundAt
            },
            { missingSkills: match.missingSkills, score: matchScore }
          );
          if (!ruleResult.eligible) {
            finalStatus = "skipped_rules";
            finalFailureReason = ruleResult.reasons[0] ?? "Rules engine blocked";
          } else {
            queuedAt = new Date();
          }
        }
        const update: Record<string, unknown> = { applicationStatus: finalStatus, failureReason: finalFailureReason };
        if (queuedAt) update.queuedAt = queuedAt;
        await Match.updateOne({ _id: match._id }, { $set: update });
      } else {
        const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(updatedJob as IJob, user);
        const intendedStatus = getAutoQueueIntendedStatus(
          { source: updatedJob.source, autoApplySupported: true },
          score
        );
        const resolved = resolveQueueStatusByUrl(
          { source: updatedJob.source, url: updatedJob.url, externalUrl: updatedJob.externalUrl, autoApplySupported: true },
          intendedStatus
        );
        let createStatus = resolved.applicationStatus;
        let createFailureReason = resolved.failureReason ?? undefined;
        let createQueuedAt: Date | undefined;
        if (resolved.applicationStatus === "queued") {
          const ruleResult = await evaluateJobForAutoApply(
            user,
            {
              _id: updatedJob._id,
              company: updatedJob.company,
              title: updatedJob.title,
              location: updatedJob.location,
              postedAt: updatedJob.postedAt,
              foundAt: updatedJob.foundAt
            },
            { missingSkills: missingSkills, score }
          );
          if (!ruleResult.eligible) {
            createStatus = "skipped_rules";
            createFailureReason = ruleResult.reasons[0] ?? "Rules engine blocked";
          } else {
            createQueuedAt = new Date();
          }
        }
        match = await Match.create({
          user: user._id,
          job: updatedJob._id,
          score,
          reasons,
          matchedSkills,
          missingSkills,
          status: "new",
          applicationStatus: createStatus,
          ...(createFailureReason && { failureReason: createFailureReason }),
          ...(createQueuedAt && { queuedAt: createQueuedAt })
        });
        updatedJob.matches = [...(updatedJob.matches ?? []), match._id];
        await updatedJob.save();
      }
      return { job: updatedJob as IJob, match };
    }
    return null;
  }

  const job = await Job.create({
    source: payload.source,
    externalId: payload.externalId,
    title: payload.title,
    company: payload.company,
    location: payload.location,
    workMode: payload.workMode,
    url: payload.url,
    description: payload.description ?? "",
    skillsExtracted: payload.skillsExtracted ?? [],
    postedAt: payload.postedAt,
    foundAt: payload.foundAt,
    hash: payload.hash,
    status: payload.status ?? "new",
    tags: payload.skillsExtracted ?? [],
    urlClassification: urlQuality.classification,
    autoApplySupported: urlQuality.autoApplySupported,
    ...(payload.country != null && { country: payload.country }),
    ...(payload.remoteSupport != null && { remoteSupport: payload.remoteSupport })
  });

  const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(job, user);
  const statusFromScore =
    payload.source === "LinkedIn"
      ? "ready_for_review"
      : getAutoQueueIntendedStatus(
          { source: job.source, autoApplySupported: job.autoApplySupported },
          score
        );
  const resolved = resolveQueueStatusByUrl(
    { source: job.source, url: job.url, externalUrl: job.externalUrl, autoApplySupported: job.autoApplySupported },
    statusFromScore
  );
  let applicationStatus = resolved.applicationStatus;
  let failureReason = resolved.failureReason ?? undefined;
  let queuedAt: Date | undefined;
  if (resolved.applicationStatus === "queued") {
    const ruleResult = await evaluateJobForAutoApply(
      user,
      {
        _id: job._id,
        company: job.company,
        title: job.title,
        location: job.location,
        postedAt: job.postedAt,
        foundAt: job.foundAt
      },
      { missingSkills: missingSkills, score }
    );
    if (!ruleResult.eligible) {
      applicationStatus = "skipped_rules";
      failureReason = ruleResult.reasons[0] ?? "Rules engine blocked";
    } else {
      queuedAt = new Date();
    }
  }
  if (resolved.applicationStatus === "skipped_unsupported" && resolved.classification != null) {
    logJobBlockedBeforeQueue(
      job.title ?? "",
      job.company ?? "",
      job.source ?? "",
      resolved.classification,
      resolved.hostname ?? null
    );
  }
  console.log(`${LOG_INGEST} autoApplySupported=${job.autoApplySupported} applicationStatus=${applicationStatus}`);
  const match = await Match.create({
    user: user._id,
    job: job._id,
    score,
    reasons,
    matchedSkills,
    missingSkills,
    status: "new",
    applicationStatus,
    ...(failureReason && { failureReason }),
    ...(queuedAt && { queuedAt })
  });

  job.matches = [...(job.matches ?? []), match._id];

  if (
    score >= HIGH_MATCH_SCORE_THRESHOLD &&
    isTelegramConfigured() &&
    !job.telegramNotifiedAt
  ) {
    const jobLink = getValidJobUrl(job) ?? "Original link unavailable";
    const sent = await sendHighMatchNotification({
      title: job.title,
      company: job.company,
      location: job.location,
      score,
      topMatchingSkills: (matchedSkills ?? []).slice(0, 5),
      jobLink
    });
    if (sent) {
      job.telegramNotifiedAt = new Date();
    }
  }

  await job.save();
  console.log("Saved job:", job.title, job.url ?? "");
  logActivity({
    type: "sync",
    source: job.source,
    jobId: String(job._id),
    matchId: String(match._id),
    status: "success",
    message: "Job saved",
    details: { title: job.title, company: job.company, score, applicationStatus }
  }).catch(() => {});

  return { job, match };
}

export async function ingestJobs(
  user: IUser,
  payloads: IngestJobPayload[]
): Promise<IngestResult> {
  const result: IngestResult = {
    inserted: 0,
    skipped: 0,
    skippedInvalidUrl: 0,
    insertedUrls: [],
    errors: []
  };

  for (const payload of payloads) {
    if (!isValidJobUrl(payload.url)) {
      result.skippedInvalidUrl += 1;
      continue;
    }
    try {
      const out = await ingestJob(user, payload);
      if (out) {
        result.inserted += 1;
        if (out.job.url) result.insertedUrls.push(out.job.url);
      } else {
        result.skipped += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${payload.externalId}: ${msg}`);
    }
  }

  return result;
}
