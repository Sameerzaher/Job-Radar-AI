import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Job, type IJob, type JobStatus } from "@/models/Job";
import { Match, type IMatch } from "@/models/Match";
import type { IUser } from "@/models/User";
import { scoreJobForUser } from "./scoring";
import { analyzeJobWithAI } from "./aiJobAnalysis";
import { tailorResumeForJob } from "./aiResumeTailor";
import { sendHighMatchNotification, isTelegramConfigured } from "./telegram";

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
      jobLink
    });
    if (sent) {
      job.telegramNotifiedAt = new Date();
    }
  }

  await job.save();

  return { job, match };
}

export function getJobLink(job: IJob & { url?: string; externalUrl?: string }): string {
  return job.url || job.externalUrl || "#";
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
