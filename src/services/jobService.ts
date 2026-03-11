import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Job, type IJob, type JobStatus } from "@/models/Job";
import { Match, type IMatch } from "@/models/Match";
import type { IUser } from "@/models/User";
import { getApplyConfig, getApplicationStatusFromScore } from "@/config/applyConfig";
import { scoreJobForUser } from "./scoring";
import { analyzeJobWithAI } from "./aiJobAnalysis";
import { tailorResumeForJob } from "./aiResumeTailor";
import { getValidJobUrl } from "@/lib/urlValidation";
import { sendHighMatchNotification, isTelegramConfigured } from "./telegram";
import { logActivity } from "./activityLogger";

const HIGH_MATCH_SCORE_THRESHOLD = 80;

export type SortBy = "score-desc" | "score-asc" | "newest";

export interface JobFilters {
  minScore?: number;
  source?: string;
  status?: string;
  location?: string;
  sortBy?: SortBy;
}

export interface JobWithScore extends IJob {
  score: number;
  reasons: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
}

export async function getJobsWithScores(
  user: IUser,
  filters: JobFilters = {}
): Promise<JobWithScore[]> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (filters.source) query.source = filters.source;
  if (filters.status) query.status = filters.status;
  if (filters.location) {
    query.location = new RegExp(filters.location, "i");
  }

  const jobs = await Job.find(query).lean<IJob[]>();

  let withScores = jobs.map((job) => {
    const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(job as unknown as IJob, user);
    return { ...job, score, reasons, matchedSkills, missingSkills };
  });

  if (filters.minScore != null) {
    withScores = withScores.filter((j) => j.score >= filters.minScore!);
  }

  const sortBy = filters.sortBy ?? "score-desc";
  if (sortBy === "score-desc") {
    withScores.sort((a, b) => b.score - a.score);
  } else if (sortBy === "score-asc") {
    withScores.sort((a, b) => a.score - b.score);
  } else {
    withScores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return withScores;
}

export async function getDashboardStats(user: IUser) {
  await connectToDatabase();
  const jobs = await Job.find().sort({ createdAt: -1 }).lean<IJob[]>();
  const withScores = jobs.map((job) => {
    const { score } = scoreJobForUser(job as unknown as IJob, user);
    return { status: job.status, score };
  });

  const totalJobs = withScores.length;
  const newJobs = withScores.filter((j) => j.status === "new").length;
  const highMatchJobs = withScores.filter((j) => j.score >= 70).length;
  const savedJobs = withScores.filter((j) => j.status === "saved").length;

  return { totalJobs, newJobs, highMatchJobs, savedJobs };
}

export async function createJobForUser(user: IUser, payload: Partial<IJob>) {
  await connectToDatabase();

  const job = await Job.create(payload);
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

  job.matches = [...(job.matches || []), match._id];

  if (
    score >= HIGH_MATCH_SCORE_THRESHOLD &&
    isTelegramConfigured() &&
    !job.telegramNotifiedAt
  ) {
    const jobLink = getJobLink(job);
    const sent = await sendHighMatchNotification({
      title: job.title,
      company: job.company,
      location: job.location,
      score,
      topMatchingSkills: (matchedSkills ?? []).slice(0, 5),
      jobLink: jobLink ?? "Original link unavailable"
    });
    if (sent) {
      job.telegramNotifiedAt = new Date();
    }
  }

  await job.save();

  return { job, match };
}

/** Returns the real external job URL, or null if missing/invalid/placeholder. */
export function getJobLink(job: IJob & { url?: string; externalUrl?: string }): string | null {
  return getValidJobUrl(job);
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<IJob | null> {
  await connectToDatabase();
  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) return null;
  const job = await Job.findByIdAndUpdate(
    jobId,
    { status },
    { new: true }
  ).lean();
  return job as IJob | null;
}

export async function getDistinctFilters(): Promise<{ sources: string[] }> {
  await connectToDatabase();
  const sources = await Job.distinct("source");
  return { sources: sources.filter(Boolean).sort() };
}

export async function getApplicationStats(userId: { _id: unknown }): Promise<{
  eligible: number;
  queued: number;
  applied: number;
  appliedWithTailoring: number;
  failed: number;
  needsReview: number;
  readyForReview: number;
}> {
  await connectToDatabase();
  const base = { user: userId._id };
  const config = getApplyConfig();
  const [queued, applied, appliedWithTailoring, failed, needsReview, readyForReview, eligible] = await Promise.all([
    Match.countDocuments({ ...base, applicationStatus: "queued" }),
    Match.countDocuments({ ...base, applicationStatus: "applied" }),
    Match.countDocuments({ ...base, applicationStatus: "applied", tailoredUsedInApply: true }),
    Match.countDocuments({ ...base, applicationStatus: "failed" }),
    Match.countDocuments({ ...base, applicationStatus: "needs_review" }),
    Match.countDocuments({ ...base, applicationStatus: "ready_for_review" }),
    Match.countDocuments({
      ...base,
      score: { $gte: config.autoApplyScoreThreshold },
      applicationStatus: { $in: ["new", "queued", "approved"] }
    })
  ]);
  return { eligible, queued, applied, appliedWithTailoring, failed, needsReview, readyForReview };
}

/** Backfill applicationStatus from score for matches that have new/undefined. */
export async function backfillApplicationStatusFromScore(userId: { _id: unknown }): Promise<number> {
  await connectToDatabase();
  const matches = await Match.find({
    user: userId._id,
    $or: [{ applicationStatus: { $exists: false } }, { applicationStatus: "new" }]
  }).lean();
  let updated = 0;
  for (const m of matches) {
    const status = getApplicationStatusFromScore(m.score);
    if (status !== "new") {
      await Match.updateOne({ _id: m._id }, { $set: { applicationStatus: status } });
      updated += 1;
    }
  }
  return updated;
}

export type ReviewQueueItem = {
  matchId: string;
  jobId: string;
  title: string;
  company: string;
  source: string;
  score: number;
  reasons: string[];
  failureReason?: string | null;
  jobUrl: string | null;
  applicationStatus: string;
};

export async function getReviewQueueItems(userId: { _id: unknown }): Promise<ReviewQueueItem[]> {
  await connectToDatabase();
  await backfillApplicationStatusFromScore(userId);
  const matches = await Match.find({
    user: userId._id,
    applicationStatus: { $in: ["ready_for_review", "needs_review", "failed"] }
  })
    .populate("job")
    .sort({ score: -1 })
    .lean();
  const items: ReviewQueueItem[] = [];
  for (const m of matches) {
    const job = m.job as unknown as IJob & { _id: unknown };
    if (!job) continue;
    items.push({
      matchId: String(m._id),
      jobId: String(job._id),
      title: job.title,
      company: job.company,
      source: job.source,
      score: m.score,
      reasons: m.reasons ?? [],
      failureReason: m.failureReason,
      jobUrl: getValidJobUrl(job),
      applicationStatus: m.applicationStatus ?? "new"
    });
  }
  return items;
}

export async function approveMatch(matchId: string, userId: { _id: unknown }): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const res = await Match.updateOne(
    { _id: matchId, user: userId._id },
    { $set: { applicationStatus: "queued" } }
  );
  if (res.modifiedCount) {
    await logActivity({ type: "review", matchId, status: "success", message: "Approved for apply" });
  }
  return res.modifiedCount > 0;
}

export async function rejectMatch(matchId: string, userId: { _id: unknown }): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const res = await Match.updateOne(
    { _id: matchId, user: userId._id },
    { $set: { applicationStatus: "rejected", status: "rejected" } }
  );
  if (res.modifiedCount) {
    await logActivity({ type: "review", matchId, status: "success", message: "Rejected" });
  }
  return res.modifiedCount > 0;
}

export async function retryMatch(matchId: string, userId: { _id: unknown }): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const res = await Match.updateOne(
    { _id: matchId, user: userId._id, applicationStatus: { $in: ["failed", "needs_review"] } },
    { $set: { applicationStatus: "queued", failureReason: null } }
  );
  if (res.modifiedCount) {
    await logActivity({ type: "review", matchId, status: "success", message: "Retry queued" });
  }
  return res.modifiedCount > 0;
}

export async function getJobById(id: string): Promise<IJob | null> {
  await connectToDatabase();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  const job = await Job.findById(id).lean();
  return job as IJob | null;
}

export async function getMatchForJobAndUser(
  jobId: string,
  userId: mongoose.Types.ObjectId
): Promise<IMatch | null> {
  await connectToDatabase();
  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) return null;
  const match = await Match.findOne({ job: jobId, user: userId }).lean();
  return match as IMatch | null;
}

export async function getOperationalMetrics(userId: { _id: unknown }): Promise<{
  syncSuccessCount: number;
  syncFailureCount: number;
  applySuccessCount: number;
  applyFailureCount: number;
  applySuccessRate: number;
  applyFailureRate: number;
  reviewQueueCount: number;
  jobsBySource: Record<string, number>;
  applicationsByStatus: Record<string, number>;
}> {
  await connectToDatabase();
  const { ActivityLog: ActivityLogModel } = await import("@/models/ActivityLog");
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const [syncSuccess, syncFailed, applySuccess, applyFailed, reviewQueue, jobCounts, matchCounts] = await Promise.all([
    ActivityLogModel.countDocuments({ type: "sync", status: "success", createdAt: { $gte: startOfWeek } }),
    ActivityLogModel.countDocuments({ type: "sync", status: "failed", createdAt: { $gte: startOfWeek } }),
    ActivityLogModel.countDocuments({ type: "apply", status: "success", createdAt: { $gte: startOfWeek } }),
    ActivityLogModel.countDocuments({ type: "apply", status: "failed", createdAt: { $gte: startOfWeek } }),
    Match.countDocuments({
      user: userId._id,
      applicationStatus: { $in: ["ready_for_review", "needs_review", "failed"] }
    }),
    Job.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
    Match.aggregate<{ _id: string; count: number }>([
      { $match: { user: userId._id } },
      { $group: { _id: "$applicationStatus", count: { $sum: 1 } } }
    ])
  ]);
  const applyTotal = applySuccess + applyFailed;
  const jobsBySource: Record<string, number> = {};
  for (const r of jobCounts) jobsBySource[r._id ?? "unknown"] = r.count;
  const applicationsByStatus: Record<string, number> = {};
  for (const r of matchCounts) applicationsByStatus[r._id ?? "new"] = r.count;
  return {
    syncSuccessCount: syncSuccess,
    syncFailureCount: syncFailed,
    applySuccessCount: applySuccess,
    applyFailureCount: applyFailed,
    applySuccessRate: applyTotal ? Math.round((applySuccess / applyTotal) * 100) : 0,
    applyFailureRate: applyTotal ? Math.round((applyFailed / applyTotal) * 100) : 0,
    reviewQueueCount: reviewQueue,
    jobsBySource,
    applicationsByStatus
  };
}

/** Ensure a match exists for this job and user (create with score if missing), then run AI analysis and save to match. */
export async function runAIAnalysisAndSave(
  jobId: string,
  user: IUser
): Promise<{ match: IMatch; analysis: Awaited<ReturnType<typeof analyzeJobWithAI>> }> {
  await connectToDatabase();
  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found");
  let match = await Match.findOne({ job: jobId, user: user._id });
  if (!match) {
    const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(job, user);
    match = await Match.create({
      user: user._id,
      job: job._id,
      score,
      reasons,
      matchedSkills,
      missingSkills,
      status: "new"
    });
    job.matches = [...(job.matches || []), match._id];
    await job.save();
  }
  const analysis = await analyzeJobWithAI(job as IJob, user);
  match.aiSummary = analysis.summary;
  match.whyItMatches = analysis.whyItMatches;
  match.aiMissingSkills = analysis.missingSkills;
  match.recommendation = analysis.recommendation;
  await match.save();
  return { match, analysis };
}

export async function runResumeTailoringAndSave(
  jobId: string,
  user: IUser
): Promise<{ match: IMatch; result: Awaited<ReturnType<typeof tailorResumeForJob>> }> {
  await connectToDatabase();
  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found");
  if (!user.resumeText || !user.resumeText.trim()) {
    throw new Error("No resume text found. Add your resume in the Profile page.");
  }

  let match = await Match.findOne({ job: jobId, user: user._id });
  if (!match) {
    const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(job, user);
    match = await Match.create({
      user: user._id,
      job: job._id,
      score,
      reasons,
      matchedSkills,
      missingSkills,
      status: "new"
    });
    job.matches = [...(job.matches || []), match._id];
    await job.save();
  }

  const result = await tailorResumeForJob(job as IJob, user.resumeText);
  match.tailoredResumeSummary = result.summary;
  match.tailoredBulletPoints = result.bulletPoints;
  match.tailoredCoverLetter = result.coverLetter;
  await match.save();

  return { match, result };
}
