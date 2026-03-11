import { connectToDatabase } from "@/lib/db";
import { getValidJobUrl, isValidJobUrl } from "@/lib/urlValidation";
import { Job, type IJob } from "@/models/Job";
import { Match } from "@/models/Match";
import type { IUser } from "@/models/User";
import { getApplicationStatusFromScore } from "@/config/applyConfig";
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

async function findExistingJob(hash: string, externalId: string, source: string): Promise<IJob | null> {
  const byHash = await Job.findOne({ hash }).lean();
  if (byHash) return byHash as IJob;
  const byExternal = await Job.findOne({ externalId, source }).lean();
  return byExternal as IJob | null;
}

export async function ingestJob(
  user: IUser,
  payload: IngestJobPayload
): Promise<{ job: IJob; match: Awaited<ReturnType<typeof Match.create>> } | null> {
  await connectToDatabase();

  if (!isValidJobUrl(payload.url)) {
    return null;
  }

  const existing = await findExistingJob(payload.hash, payload.externalId, payload.source);
  if (existing) return null;

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
    tags: payload.skillsExtracted ?? []
  });

  const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(job, user);
  const applicationStatus = getApplicationStatusFromScore(score);
  const match = await Match.create({
    user: user._id,
    job: job._id,
    score,
    reasons,
    matchedSkills,
    missingSkills,
    status: "new",
    applicationStatus
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
