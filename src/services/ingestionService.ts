import { connectToDatabase } from "@/lib/db";
import { Job, type IJob } from "@/models/Job";
import { Match } from "@/models/Match";
import type { IUser } from "@/models/User";
import { scoreJobForUser } from "./scoring";
import { sendHighMatchNotification, isTelegramConfigured } from "./telegram";
import type { IngestJobPayload } from "@/types/job";

const HIGH_MATCH_SCORE_THRESHOLD = 80;

export interface IngestResult {
  inserted: number;
  skipped: number;
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
  const match = await Match.create({
    user: user._id,
    job: job._id,
    score,
    reasons,
    matchedSkills,
    missingSkills,
    status: "new"
  });

  job.matches = [...(job.matches ?? []), match._id];

  if (
    score >= HIGH_MATCH_SCORE_THRESHOLD &&
    isTelegramConfigured() &&
    !job.telegramNotifiedAt
  ) {
    const jobLink = job.url || job.externalUrl || "#";
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

  return { job, match };
}

export async function ingestJobs(
  user: IUser,
  payloads: IngestJobPayload[]
): Promise<IngestResult> {
  const result: IngestResult = { inserted: 0, skipped: 0, errors: [] };

  for (const payload of payloads) {
    try {
      const out = await ingestJob(user, payload);
      if (out) result.inserted += 1;
      else result.skipped += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${payload.externalId}: ${msg}`);
    }
  }

  return result;
}
