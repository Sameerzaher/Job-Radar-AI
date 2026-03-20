import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Job, type IJob, type JobStatus } from "@/models/Job";
import { Match, type IMatch } from "@/models/Match";
import { User, type IUser } from "@/models/User";
import { getApplyConfig, getApplicationStatusFromScore, getWorkerConfig } from "@/config/applyConfig";
import { scoreJobForUser } from "./scoring";
import { analyzeJobWithAI } from "./aiJobAnalysis";
import { tailorResumeForJob } from "./aiResumeTailor";
import { getValidJobUrl } from "@/lib/urlValidation";
import { sendHighMatchNotification, isTelegramConfigured } from "./telegram";
import { logActivity } from "./activityLogger";

const HIGH_MATCH_SCORE_THRESHOLD = 80;

export type SortBy = "score-desc" | "score-asc" | "newest";

export type SeniorityFilter = "junior" | "mid" | "senior";

export interface JobFilters {
  minScore?: number;
  source?: string;
  status?: string;
  location?: string;
  sortBy?: SortBy;
  /** Filter by company name (partial match). */
  company?: string;
  /** Filter by provider/source (e.g. Greenhouse, Lever). */
  provider?: string;
  /** Filter jobs from boards with remote support, or workMode Remote, or location contains "remote". */
  remoteSupport?: boolean;
  /** Filter by job title seniority (junior, mid, senior). */
  seniority?: SeniorityFilter;
  /** Filter by country (e.g. US, global). */
  country?: string;
  /** Filter by tag (job must have at least one of these). */
  tags?: string[];
  /** Filter by auto-apply support (true = only jobs with supported apply URL). */
  autoApplySupported?: boolean;
  /** Filter by company application history: has_prior = companies with prior applications; never_applied = no history; on_cooldown = within cooldown window. */
  companyMemoryFilter?: "has_prior" | "never_applied" | "on_cooldown";
}

export interface JobWithScore extends IJob {
  score: number;
  reasons: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  /** Present when a match exists for this job and current user. */
  matchId?: string;
  /** Application status from the match (new, queued, applied, etc.). */
  applicationStatus?: string;
  /** True when user overrode rules and sent this match to queue. */
  rulesOverridden?: boolean;
}

export async function getJobsWithScores(
  user: IUser,
  filters: JobFilters = {}
): Promise<JobWithScore[]> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (filters.source) query.source = filters.source;
  else if (filters.provider) query.source = filters.provider;
  if (filters.status) query.status = filters.status;
  if (filters.location) {
    query.location = new RegExp(filters.location, "i");
  }
  if (filters.company) {
    query.company = new RegExp(filters.company, "i");
  }
  const andConditions: Record<string, unknown>[] = [];
  if (filters.remoteSupport === true) {
    andConditions.push({
      $or: [
        { remoteSupport: true },
        { workMode: "Remote" },
        { location: new RegExp("remote", "i") }
      ]
    });
  }
  if (filters.seniority) {
    const titlePattern =
      filters.seniority === "junior"
        ? /junior/i
        : filters.seniority === "senior"
          ? /senior/i
          : /\bmid\b|middle/i;
    query.title = titlePattern;
  }
  if (filters.country) {
    query.country = filters.country;
  }
  if (filters.tags?.length) {
    query.tags = { $in: filters.tags };
  }
  if (filters.autoApplySupported === true) {
    andConditions.push({ autoApplySupported: true });
  } else if (filters.autoApplySupported === false) {
    andConditions.push({
      $or: [{ autoApplySupported: false }, { autoApplySupported: { $exists: false } }]
    });
  }
  if (andConditions.length) query.$and = andConditions;

  /** Cap jobs per request so scoring and render stay fast. */
  const JOBS_PAGE_LIMIT = 500;
  const jobs = await Job.find(query).sort({ createdAt: -1 }).limit(JOBS_PAGE_LIMIT).lean<IJob[]>();

  let withScores = jobs.map((job) => {
    const { score, reasons, matchedSkills, missingSkills } = scoreJobForUser(job as unknown as IJob, user);
    return { ...job, score, reasons, matchedSkills, missingSkills };
  });

  if (filters.minScore != null) {
    withScores = withScores.filter((j) => j.score >= filters.minScore!);
  }

  const companyMemoryFilter = filters.companyMemoryFilter;
  if (companyMemoryFilter) {
    const { normalizeCompanyName } = await import("@/lib/companyNormalization");
    const { listCompanyMemoriesByUser, getCompaniesOnCooldownForUser } = await import("@/services/companyMemory/companyMemoryService");
    const { getRulesConfig } = await import("@/services/rules/rulesConfig");
    const memories = await listCompanyMemoriesByUser(user);
    const memorySet = new Set(memories.map((m) => m.normalizedCompanyName));
    const cooldownDays = getRulesConfig().companyCooldownDays;
    const cooldownSet = companyMemoryFilter === "on_cooldown" ? await getCompaniesOnCooldownForUser(user, cooldownDays) : null;
    withScores = withScores.filter((job) => {
      const company = (job as IJob).company ?? "";
      const normalized = normalizeCompanyName(company);
      if (companyMemoryFilter === "has_prior") return memorySet.has(normalized);
      if (companyMemoryFilter === "never_applied") return !memorySet.has(normalized);
      if (companyMemoryFilter === "on_cooldown" && cooldownSet) return normalized && cooldownSet.has(normalized);
      return true;
    });
  }

  const sortBy = filters.sortBy ?? "score-desc";
  if (sortBy === "score-desc") {
    withScores.sort((a, b) => b.score - a.score);
  } else if (sortBy === "score-asc") {
    withScores.sort((a, b) => a.score - b.score);
  } else {
    withScores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const jobIds = withScores.map((j) => j._id);
  const matches = await Match.find({ user: user._id, job: { $in: jobIds } })
    .select("_id job applicationStatus rulesOverridden")
    .lean();
  const matchByJob = new Map<string, { matchId: string; applicationStatus: string; rulesOverridden?: boolean }>();
  for (const m of matches) {
    const jid = String((m as { job: unknown }).job);
    matchByJob.set(jid, {
      matchId: String((m as { _id: unknown })._id),
      applicationStatus: (m as { applicationStatus?: string }).applicationStatus ?? "new",
      rulesOverridden: (m as { rulesOverridden?: boolean }).rulesOverridden
    });
  }

  return withScores.map((job) => {
    const extra = matchByJob.get(job._id.toString());
    return extra
      ? { ...job, matchId: extra.matchId, applicationStatus: extra.applicationStatus, rulesOverridden: extra.rulesOverridden }
      : job;
  });
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
  skippedRules: number;
  skippedUnsupported: number;
}> {
  await connectToDatabase();
  const base = { user: userId._id };
  const config = getApplyConfig();
  const [queued, applied, appliedWithTailoring, failed, needsReview, readyForReview, eligible, skippedRules, skippedUnsupported] = await Promise.all([
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
    }),
    Match.countDocuments({ ...base, applicationStatus: "skipped_rules" }),
    Match.countDocuments({ ...base, applicationStatus: "skipped_unsupported" })
  ]);
  return { eligible, queued, applied, appliedWithTailoring, failed, needsReview, readyForReview, skippedRules, skippedUnsupported };
}

export async function getGreenhouseMetrics(userId: { _id: unknown }): Promise<{
  supportedJobs: number;
  queued: number;
  appliedToday: number;
  needsReviewToday: number;
}> {
  await connectToDatabase();
  const todayStart = startOfTodayUTC();

  const [supportedJobs, queuedAgg, appliedTodayAgg, needsReviewTodayAgg] = await Promise.all([
    Job.countDocuments({ source: "Greenhouse", autoApplySupported: true }),
    Match.aggregate([
      { $match: { user: userId._id, applicationStatus: { $in: ["queued", "approved"] } } },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "j" } },
      { $unwind: "$j" },
      { $match: { "j.source": "Greenhouse" } },
      { $count: "n" }
    ]),
    Match.aggregate([
      { $match: { user: userId._id, applicationStatus: "applied", appliedAt: { $gte: todayStart } } },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "j" } },
      { $unwind: "$j" },
      { $match: { "j.source": "Greenhouse" } },
      { $count: "n" }
    ]),
    Match.aggregate([
      { $match: { user: userId._id, applicationStatus: "needs_review", updatedAt: { $gte: todayStart } } },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "j" } },
      { $unwind: "$j" },
      { $match: { "j.source": "Greenhouse" } },
      { $count: "n" }
    ])
  ]);

  const queued = queuedAgg[0]?.n ?? 0;
  const appliedToday = appliedTodayAgg[0]?.n ?? 0;
  const needsReviewToday = needsReviewTodayAgg[0]?.n ?? 0;

  return { supportedJobs, queued, appliedToday, needsReviewToday };
}

export async function getGreenhouseReadiness(userId: { _id: unknown }): Promise<{
  supportedJobs: number;
  queued: number;
  attemptedToday: number;
  appliedToday: number;
  successRate: number | null;
}> {
  await connectToDatabase();
  const todayStart = startOfTodayUTC();

  const [supportedJobs, queuedAgg, todayAgg] = await Promise.all([
    Job.countDocuments({ source: "Greenhouse", autoApplySupported: true }),
    Match.aggregate([
      { $match: { user: userId._id, applicationStatus: { $in: ["queued", "approved"] } } },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "j" } },
      { $unwind: "$j" },
      { $match: { "j.source": "Greenhouse" } },
      { $count: "n" }
    ]),
    Match.aggregate([
      {
        $match: {
          user: userId._id,
          updatedAt: { $gte: todayStart },
          applicationStatus: { $in: ["applied", "failed", "needs_review"] }
        }
      },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "j" } },
      { $unwind: "$j" },
      { $match: { "j.source": "Greenhouse" } },
      {
        $group: {
          _id: null,
          attempted: { $sum: 1 },
          applied: { $sum: { $cond: [{ $eq: ["$applicationStatus", "applied"] }, 1, 0] } }
        }
      }
    ])
  ]);

  const queued = queuedAgg[0]?.n ?? 0;
  const attemptedToday = todayAgg[0]?.attempted ?? 0;
  const appliedToday = todayAgg[0]?.applied ?? 0;
  const successRate =
    attemptedToday > 0 ? Math.round((appliedToday / attemptedToday) * 100) : null;

  return { supportedJobs, queued, attemptedToday, appliedToday, successRate };
}

export async function getAutoQueueMetrics(userId: { _id: unknown }): Promise<{
  autoQueuedToday: number;
  greenhouseAutoQueuedToday: number;
  lastRunBlockedByThreshold: number | null;
  lastRunBlockedByRules: number | null;
}> {
  await connectToDatabase();
  const todayStart = startOfTodayUTC();

  const [autoQueuedTodayAgg, greenhouseAutoQueuedAgg, lastRunLog] = await Promise.all([
    Match.countDocuments({
      user: userId._id,
      applicationStatus: "queued",
      queuedAt: { $gte: todayStart }
    }),
    Match.aggregate([
      { $match: { user: userId._id, applicationStatus: "queued", queuedAt: { $gte: todayStart } } },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "j" } },
      { $unwind: "$j" },
      { $match: { "j.source": "Greenhouse" } },
      { $count: "n" }
    ]),
    (async () => {
      const { ActivityLog: ActivityLogModel } = await import("@/models/ActivityLog");
      const log = await ActivityLogModel.findOne(
        { type: "apply", message: "Auto-queue pass", "details.userId": userId._id }
      )
        .sort({ createdAt: -1 })
        .lean();
      return log;
    })()
  ]);

  const greenhouseAutoQueuedToday = greenhouseAutoQueuedAgg[0]?.n ?? 0;
  const details = lastRunLog?.details as { skippedByLowScore?: number; skippedByRules?: number } | undefined;
  const lastRunBlockedByThreshold = details?.skippedByLowScore ?? null;
  const lastRunBlockedByRules = details?.skippedByRules ?? null;

  return {
    autoQueuedToday: autoQueuedTodayAgg,
    greenhouseAutoQueuedToday,
    lastRunBlockedByThreshold: lastRunBlockedByThreshold != null ? lastRunBlockedByThreshold : null,
    lastRunBlockedByRules: lastRunBlockedByRules != null ? lastRunBlockedByRules : null
  };
}

/** Queue only eligible Greenhouse auto-apply matches (ready_for_review, score >= threshold, job source=Greenhouse, autoApplySupported=true). Skips companies in review-required list. */
export async function queueGreenhouseAutoApplyJobs(userId: { _id: unknown }): Promise<{ queued: number; message: string }> {
  await connectToDatabase();
  const userDoc = await User.findById(userId._id).lean();
  const companyReviewRequired = (userDoc as { autoApplyReviewRequiredCompanies?: string[] } | null)?.autoApplyReviewRequiredCompanies ?? [];
  const reviewRequiredSet = new Set(companyReviewRequired.map((c) => String(c).trim().toLowerCase()).filter(Boolean));

  const {
    resolveQueueStatusByUrl,
    logJobBlockedBeforeQueue
  } = await import("@/services/autoApply/queueEligibility");
  const config = getApplyConfig();

  const matches = await Match.find({
    user: userId._id,
    applicationStatus: "ready_for_review",
    score: { $gte: config.autoApplyScoreThreshold }
  })
    .populate("job")
    .lean();

  let queued = 0;
  for (const m of matches) {
    const job = m.job as unknown as {
      source?: string;
      title?: string;
      company?: string;
      url?: string;
      externalUrl?: string;
      autoApplySupported?: boolean;
    };
    if (!job || job.source !== "Greenhouse" || job.autoApplySupported !== true) continue;
    const companyLower = (job.company ?? "").trim().toLowerCase();
    if (companyLower && reviewRequiredSet.has(companyLower)) continue;
    const resolved = resolveQueueStatusByUrl(job, "queued");
    if (resolved.applicationStatus !== "queued") {
      if (resolved.applicationStatus === "skipped_unsupported" && resolved.classification != null) {
        logJobBlockedBeforeQueue(
          job.title ?? "",
          job.company ?? "",
          job.source ?? "",
          resolved.classification,
          resolved.hostname ?? null
        );
      }
      continue;
    }
    await Match.updateOne(
      { _id: m._id },
      { $set: { applicationStatus: "queued", failureReason: null } }
    );
    queued += 1;
  }
  return {
    queued,
    message: queued > 0 ? `Queued ${queued} Greenhouse auto-apply job(s).` : "No eligible Greenhouse jobs to queue (need ready_for_review, score ≥ threshold, source=Greenhouse, autoApplySupported=true)."
  };
}

/** Backfill applicationStatus from score; for Greenhouse queued, run rules and set queuedAt. */
export async function backfillApplicationStatusFromScore(userId: { _id: unknown }): Promise<number> {
  await connectToDatabase();
  const userDoc = await User.findById(userId._id).lean();
  const companyBlacklist = (userDoc as { autoApplyBlacklistCompanies?: string[] } | null)?.autoApplyBlacklistCompanies ?? [];
  const companyReviewRequired = (userDoc as { autoApplyReviewRequiredCompanies?: string[] } | null)?.autoApplyReviewRequiredCompanies ?? [];

  const {
    resolveQueueStatusByUrl,
    logJobBlockedBeforeQueue,
    getAutoQueueIntendedStatus
  } = await import("@/services/autoApply/queueEligibility");
  const { evaluateJobForAutoApply } = await import("@/services/rules/rulesEngine");

  const matches = await Match.find({
    user: userId._id,
    $or: [
      { applicationStatus: { $in: ["new", "queued", "ready_for_review"] } },
      { applicationStatus: { $exists: false } }
    ]
  })
    .populate("job")
    .lean();

  let updated = 0;
  for (const m of matches) {
    const job = m.job as unknown as {
      _id: unknown;
      source?: string;
      title?: string;
      company?: string;
      location?: string;
      url?: string;
      externalUrl?: string;
      autoApplySupported?: boolean;
      postedAt?: Date | null;
      foundAt?: Date | null;
    };
    const intendedStatus = getAutoQueueIntendedStatus(
      job ?? { source: "", autoApplySupported: false },
      m.score
    );
    const resolved = resolveQueueStatusByUrl(
      job ?? { source: "", url: undefined, autoApplySupported: false },
      intendedStatus
    );

    let finalStatus = resolved.applicationStatus;
    let finalFailureReason = resolved.failureReason ?? null;
    let queuedAt: Date | null = null;

    if (resolved.applicationStatus === "queued") {
      const ruleResult = await evaluateJobForAutoApply(
        userId,
        {
          _id: job?._id,
          company: job?.company ?? "",
          title: job?.title ?? "",
          location: job?.location ?? "",
          postedAt: job?.postedAt,
          foundAt: job?.foundAt
        },
        { missingSkills: (m as { missingSkills?: string[] }).missingSkills, score: (m as { score?: number }).score },
        undefined,
        { companyBlacklist }
      );
      if (!ruleResult.eligible) {
        finalStatus = "skipped_rules";
        finalFailureReason = ruleResult.reasons[0] ?? "Rules engine blocked";
      } else {
        const companyLower = (job?.company ?? "").trim().toLowerCase();
        const reviewRequiredSet = new Set(companyReviewRequired.map((c) => String(c).trim().toLowerCase()).filter(Boolean));
        if (companyLower && reviewRequiredSet.has(companyLower)) {
          finalStatus = "ready_for_review";
        } else {
          queuedAt = new Date();
        }
      }
    }

    const current = m.applicationStatus ?? "new";
    const currentFailure = m.failureReason ?? null;
    if (
      finalStatus !== current ||
      finalFailureReason !== currentFailure ||
      (queuedAt != null && (m as { queuedAt?: Date }).queuedAt == null)
    ) {
      const update: Record<string, unknown> = { applicationStatus: finalStatus };
      if (finalFailureReason != null) update.failureReason = finalFailureReason;
      else if (finalStatus !== "skipped_unsupported") update.failureReason = null;
      if (queuedAt != null) update.queuedAt = queuedAt;
      await Match.updateOne({ _id: m._id }, { $set: update });
      updated += 1;
      if (resolved.applicationStatus === "skipped_unsupported" && resolved.classification != null) {
        logJobBlockedBeforeQueue(
          job?.title ?? "",
          job?.company ?? "",
          job?.source ?? "",
          resolved.classification,
          resolved.hostname ?? null
        );
      }
    }
  }
  return updated;
}

/**
 * Re-evaluate matches that are skipped_rules only due to seniority (senior-level rule removed).
 * Sets them to queued (if score+URL+rules allow) or ready_for_review, and clears failureReason.
 */
export async function recheckSkippedRulesMatchesForSeniority(userId: { _id: unknown }): Promise<{
  updated: number;
  queued: number;
  readyForReview: number;
}> {
  await connectToDatabase();
  const userDoc = await User.findById(userId._id).lean();
  const companyBlacklist = (userDoc as { autoApplyBlacklistCompanies?: string[] } | null)?.autoApplyBlacklistCompanies ?? [];
  const companyReviewRequired = (userDoc as { autoApplyReviewRequiredCompanies?: string[] } | null)?.autoApplyReviewRequiredCompanies ?? [];

  const { isSeniorityOnlyFailureReason } = await import("@/services/rules/rulesConfig");
  const {
    resolveQueueStatusByUrl,
    getAutoQueueIntendedStatus
  } = await import("@/services/autoApply/queueEligibility");
  const { evaluateJobForAutoApply } = await import("@/services/rules/rulesEngine");

  const matches = await Match.find({
    user: userId._id,
    applicationStatus: "skipped_rules"
  })
    .populate("job")
    .lean();

  let updated = 0;
  let queued = 0;
  let readyForReview = 0;
  for (const m of matches) {
    const reason = (m as { failureReason?: string | null }).failureReason;
    if (!isSeniorityOnlyFailureReason(reason)) continue;

    const job = m.job as unknown as {
      _id: unknown;
      source?: string;
      title?: string;
      company?: string;
      location?: string;
      url?: string;
      externalUrl?: string;
      autoApplySupported?: boolean;
      postedAt?: Date | null;
      foundAt?: Date | null;
    };
    if (!job) continue;

    const score = (m as { score: number }).score;
    const intendedStatus = getAutoQueueIntendedStatus(
      { source: job.source ?? "", autoApplySupported: job.autoApplySupported },
      score
    );
    const resolved = resolveQueueStatusByUrl(
      {
        source: job.source ?? "",
        url: job.url,
        externalUrl: job.externalUrl,
        autoApplySupported: job.autoApplySupported
      },
      intendedStatus
    );

    let finalStatus = resolved.applicationStatus;
    let queuedAt: Date | null = null;
    if (resolved.applicationStatus === "queued") {
      const ruleResult = await evaluateJobForAutoApply(
        userId,
        {
          _id: job._id,
          company: job.company ?? "",
          title: job.title ?? "",
          location: job.location ?? "",
          postedAt: job.postedAt,
          foundAt: job.foundAt
        },
        { missingSkills: (m as { missingSkills?: string[] }).missingSkills, score },
        undefined,
        { companyBlacklist }
      );
      if (ruleResult.eligible) {
        const companyLower = (job.company ?? "").trim().toLowerCase();
        const reviewRequiredSet = new Set(companyReviewRequired.map((c) => String(c).trim().toLowerCase()).filter(Boolean));
        if (companyLower && reviewRequiredSet.has(companyLower)) {
          finalStatus = "ready_for_review";
          readyForReview += 1;
        } else {
          finalStatus = "queued";
          queuedAt = new Date();
          queued += 1;
        }
      } else {
        finalStatus = "ready_for_review";
        readyForReview += 1;
      }
    } else {
      readyForReview += 1;
    }

    const update: Record<string, unknown> = {
      applicationStatus: finalStatus,
      failureReason: null
    };
    if (queuedAt) update.queuedAt = queuedAt;
    await Match.updateOne({ _id: m._id }, { $set: update });
    updated += 1;
  }
  if (updated > 0) {
    console.log(
      `[JobRadar] recheckSkippedRulesMatchesForSeniority | updated=${updated} queued=${queued} ready_for_review=${readyForReview}`
    );
  }
  return { updated, queued, readyForReview };
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
  /** True when job has a supported direct apply URL. */
  autoApplySupported?: boolean;
  /** URL quality from ingestion. */
  urlClassification?: string;
  /** True when user overrode rules and sent this match to queue. */
  rulesOverridden?: boolean;
  /** Apply profile name (when using apply profiles). */
  applyProfileName?: string | null;
  /** Company application history for this job's company (optional). */
  companyMemory?: {
    lastAppliedAt: string | null;
    lastOutcome: string | null;
    lastApplyProfileName: string;
    totalApplications: number;
  } | null;
};

export type ReviewQueueFilter = {
  applicationStatus?: string[];
  failureReason?: string;
  /** Filter by job source/provider (e.g. Greenhouse, Lever). */
  provider?: string;
  /** Filter by company name (partial match). */
  company?: string;
  /** Filter by auto-apply support (true = only supported apply URL jobs). */
  autoApplySupported?: boolean;
};

/** Max review queue items to load per request (avoids slow page when many matches). */
const REVIEW_QUEUE_LIMIT = 300;

export async function getReviewQueueItems(
  userId: { _id: unknown },
  filter?: ReviewQueueFilter
): Promise<ReviewQueueItem[]> {
  await connectToDatabase();
  // Backfill removed from critical path – was running on every page load and slowing the review page.
  // It still runs when the auto-apply worker runs (applyAgent). Use "Sync queue status" or re-run worker to sync.
  const statuses = filter?.applicationStatus ?? [
    "ready_for_review",
    "needs_review",
    "failed",
    "skipped_rules",
    "skipped_unsupported"
  ];
  let query: Record<string, unknown> = {
    user: userId._id,
    applicationStatus: { $in: statuses }
  };
  if (filter?.failureReason?.trim()) {
    const reason = filter.failureReason.trim();
    query.failureReason = new RegExp(reason, "i");
  }
  const matches = await Match.find(query)
    .populate("job")
    .sort({ score: -1 })
    .limit(REVIEW_QUEUE_LIMIT)
    .lean();
  const items: ReviewQueueItem[] = [];
  const providerLower = filter?.provider?.trim().toLowerCase();
  const companySubstring = filter?.company?.trim().toLowerCase();
  const autoApplyFilter = filter?.autoApplySupported;
  for (const m of matches) {
    const job = m.job as unknown as IJob & { _id: unknown; autoApplySupported?: boolean; urlClassification?: string };
    if (!job) continue;
    if (providerLower && (job.source ?? "").toLowerCase() !== providerLower) continue;
    if (companySubstring && !(job.company ?? "").toLowerCase().includes(companySubstring)) continue;
    if (autoApplyFilter === true && !job.autoApplySupported) continue;
    if (autoApplyFilter === false && job.autoApplySupported === true) continue;
    const matchWithProfile = m as { applyProfileName?: string | null };
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
      applicationStatus: m.applicationStatus ?? "new",
      autoApplySupported: job.autoApplySupported,
      urlClassification: job.urlClassification,
      rulesOverridden: (m as { rulesOverridden?: boolean }).rulesOverridden === true,
      applyProfileName: matchWithProfile.applyProfileName ?? null
    });
  }
  const uniqueCompanies = [...new Set(items.map((i) => i.company).filter(Boolean))];
  const { getCompanyMemoryByUserAndCompany } = await import("@/services/companyMemory/companyMemoryService");
  const memoryByCompany: Record<string, ReviewQueueItem["companyMemory"]> = {};
  for (const company of uniqueCompanies) {
    const mem = await getCompanyMemoryByUserAndCompany(userId, company);
    if (mem) {
      memoryByCompany[company] = {
        lastAppliedAt: mem.lastAppliedAt ? mem.lastAppliedAt.toISOString() : null,
        lastOutcome: mem.lastOutcome ?? null,
        lastApplyProfileName: mem.lastApplyProfileName ?? "",
        totalApplications: mem.totalApplications ?? 0
      };
    }
  }
  return items.map((item) => ({
    ...item,
    companyMemory: memoryByCompany[item.company] ?? null
  }));
}

/**
 * Manually override rules and move a skipped_rules match back to the auto-apply queue.
 * Requires supported URL and provider; does not bypass URL/provider safety.
 */
export async function overrideRulesAndQueue(matchId: string, userId: { _id: unknown }): Promise<{ ok: boolean; error?: string }> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    return { ok: false, error: "Invalid match ID" };
  }
  const match = await Match.findOne({
    _id: matchId,
    user: userId._id,
    applicationStatus: "skipped_rules"
  })
    .populate("job")
    .lean();
  if (!match) {
    return { ok: false, error: "Match not found or not skipped by rules" };
  }
  const job = match.job as unknown as {
    _id: unknown;
    source?: string;
    title?: string;
    company?: string;
    autoApplySupported?: boolean;
    urlClassification?: string;
  };
  if (!job) {
    return { ok: false, error: "Job not found" };
  }
  if (job.autoApplySupported !== true) {
    return { ok: false, error: "This job cannot be auto-applied (unsupported URL)" };
  }
  if (job.urlClassification !== "supported_apply_url") {
    return { ok: false, error: "This job cannot be auto-applied (unsupported URL)" };
  }

  const now = new Date();
  await Match.updateOne(
    { _id: matchId, user: userId._id },
    { $set: { applicationStatus: "queued", failureReason: null, rulesOverridden: true, queuedAt: now } }
  );
  console.log(
    "[JobRadar] manual override applied | matchId=%s job=%s @ %s – job moved from skipped_rules to queued",
    matchId,
    job.title ?? "",
    job.company ?? ""
  );
  await logActivity({
    type: "apply",
    status: "info",
    message: "Rules overridden; job sent to queue",
    matchId,
    details: { title: job.title, company: job.company }
  });
  return { ok: true };
}

export async function approveMatch(matchId: string, userId: { _id: unknown }): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const {
    resolveQueueStatusByUrl,
    logJobBlockedBeforeQueue
  } = await import("@/services/autoApply/queueEligibility");

  const match = await Match.findOne({ _id: matchId, user: userId._id }).populate("job").lean();
  if (!match) return false;
  const job = match.job as unknown as {
    source?: string;
    title?: string;
    company?: string;
    url?: string;
    externalUrl?: string;
    autoApplySupported?: boolean;
  };
  if (!job) return false;

  const resolved = resolveQueueStatusByUrl(job, "queued");
  if (resolved.applicationStatus === "skipped_unsupported") {
    await Match.updateOne(
      { _id: matchId, user: userId._id },
      { $set: { applicationStatus: "skipped_unsupported", failureReason: resolved.failureReason } }
    );
    logJobBlockedBeforeQueue(
      job.title ?? "",
      job.company ?? "",
      job.source ?? "",
      resolved.classification ?? "unknown",
      resolved.hostname ?? null
    );
    await logActivity({ type: "review", matchId, status: "info", message: "Approved but URL unsupported; set to skipped_unsupported" });
    return true;
  }
  const res = await Match.updateOne(
    { _id: matchId, user: userId._id },
    { $set: { applicationStatus: "queued", failureReason: null } }
  );
  if (res.modifiedCount) {
    await logActivity({ type: "review", matchId, status: "success", message: "Approved for apply" });
  }
  return res.modifiedCount > 0;
}

export async function rejectMatch(matchId: string, userId: { _id: unknown }): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const match = await Match.findOne({ _id: matchId, user: userId._id }).populate("job").lean();
  const res = await Match.updateOne(
    { _id: matchId, user: userId._id },
    { $set: { applicationStatus: "rejected", status: "rejected" } }
  );
  if (res.modifiedCount && match?.job) {
    const job = match.job as { company?: string; title?: string };
    const { recordApplicationOutcome } = await import("@/services/companyMemory/companyMemoryService");
    await recordApplicationOutcome({
      userId: userId._id,
      companyName: job.company ?? "",
      jobTitle: job.title ?? "",
      outcome: "rejected"
    });
    await logActivity({ type: "review", matchId, status: "success", message: "Rejected" });
  } else if (res.modifiedCount) {
    await logActivity({ type: "review", matchId, status: "success", message: "Rejected" });
  }
  return res.modifiedCount > 0;
}

export async function retryMatch(matchId: string, userId: { _id: unknown }): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const {
    resolveQueueStatusByUrl,
    logJobBlockedBeforeQueue
  } = await import("@/services/autoApply/queueEligibility");

  const match = await Match.findOne({
    _id: matchId,
    user: userId._id,
    applicationStatus: { $in: ["failed", "needs_review"] }
  })
    .populate("job")
    .lean();
  if (!match) return false;
  const job = match.job as unknown as { source?: string; title?: string; company?: string; url?: string; externalUrl?: string };
  if (!job) return false;

  const resolved = resolveQueueStatusByUrl(job, "queued");
  if (resolved.applicationStatus === "skipped_unsupported") {
    await Match.updateOne(
      { _id: matchId, user: userId._id },
      { $set: { applicationStatus: "skipped_unsupported", failureReason: resolved.failureReason } }
    );
    logJobBlockedBeforeQueue(
      job.title ?? "",
      job.company ?? "",
      job.source ?? "",
      resolved.classification ?? "unknown",
      resolved.hostname ?? null
    );
    await logActivity({ type: "review", matchId, status: "info", message: "Retry blocked; URL unsupported" });
    return true;
  }
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

/** Set or clear the user-selected apply profile for a match (used on job details / review before apply). */
export async function updateMatchSelectedApplyProfile(
  matchId: string,
  userId: mongoose.Types.ObjectId | string,
  applyProfileId: string | null
): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;
  const uid = typeof userId === "string" ? userId : userId.toString();
  const update: Record<string, unknown> = { selectedApplyProfileId: applyProfileId ? new mongoose.Types.ObjectId(applyProfileId) : null };
  const result = await Match.updateOne({ _id: matchId, user: uid }, { $set: update });
  return result.modifiedCount > 0;
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
  lastAutoApplyHeartbeat?: Date | null;
  autoApplyWorkerStale?: boolean;
  lastAutoApplyRunStartedAt?: Date | null;
  lastAutoApplyRunCompletedAt?: Date | null;
  lastAutoApplyRunStatus?: string | null;
}> {
  await connectToDatabase();
  const { ActivityLog: ActivityLogModel } = await import("@/models/ActivityLog");
  const { AutoApplyLock } = await import("@/models/AutoApplyLock");
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const [syncSuccess, syncFailed, applySuccess, applyFailed, reviewQueue, jobCounts, matchCounts, lockDoc] = await Promise.all([
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
    ]),
    AutoApplyLock.findOne({ key: "auto-apply" }).lean()
  ]);
  const applyTotal = applySuccess + applyFailed;
  const jobsBySource: Record<string, number> = {};
  for (const r of jobCounts) jobsBySource[r._id ?? "unknown"] = r.count;
  const applicationsByStatus: Record<string, number> = {};
  for (const r of matchCounts) applicationsByStatus[r._id ?? "new"] = r.count;
  const lastHeartbeat = lockDoc?.heartbeatAt ?? null;
  const { heartbeatTtlMinutes } = getWorkerConfig();
  const stale =
    lastHeartbeat != null
      ? Date.now() - new Date(lastHeartbeat).getTime() > heartbeatTtlMinutes * 60_000
      : true;
  return {
    syncSuccessCount: syncSuccess,
    syncFailureCount: syncFailed,
    applySuccessCount: applySuccess,
    applyFailureCount: applyFailed,
    applySuccessRate: applyTotal ? Math.round((applySuccess / applyTotal) * 100) : 0,
    applyFailureRate: applyTotal ? Math.round((applyFailed / applyTotal) * 100) : 0,
    reviewQueueCount: reviewQueue,
    jobsBySource,
    applicationsByStatus,
    lastAutoApplyHeartbeat: lastHeartbeat,
    autoApplyWorkerStale: stale,
    lastAutoApplyRunStartedAt: lockDoc?.lastRunStartedAt ?? null,
    lastAutoApplyRunCompletedAt: lockDoc?.lastRunCompletedAt ?? null,
    lastAutoApplyRunStatus: (lockDoc?.lastRunStatus as string | undefined) ?? null
  };
}

/** Start of today UTC for daily counts. */
function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type DashboardDayActivity = {
  date: string;
  label: string;
  jobsAdded: number;
  applied: number;
};

/** Last 7 days (UTC) with jobs added and applications count per day for dashboard charts. */
export async function getDashboardActivitySeries(userId: { _id: unknown }): Promise<DashboardDayActivity[]> {
  await connectToDatabase();
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  start.setUTCHours(0, 0, 0, 0);

  const [jobBuckets, appliedBuckets] = await Promise.all([
    Job.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, count: { $sum: 1 } } }
    ]),
    Match.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          user: userId._id,
          applicationStatus: "applied",
          appliedAt: { $exists: true, $gte: start }
        }
      },
      { $group: { _id: { $dateToString: { date: "$appliedAt", format: "%Y-%m-%d" } }, count: { $sum: 1 } } }
    ])
  ]);

  const jobsByDate: Record<string, number> = {};
  jobBuckets.forEach((r) => { jobsByDate[r._id] = r.count; });
  const appliedByDate: Record<string, number> = {};
  appliedBuckets.forEach((r) => { appliedByDate[r._id] = r.count; });

  const series: DashboardDayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    series.push({
      date: dateStr,
      label,
      jobsAdded: jobsByDate[dateStr] ?? 0,
      applied: appliedByDate[dateStr] ?? 0
    });
  }
  return series;
}

export async function getWorkerHealth(userId: { _id: unknown }): Promise<{
  workerRunning: boolean;
  lastHeartbeatAt: Date | null;
  lastRunStartedAt: Date | null;
  lastRunCompletedAt: Date | null;
  lockActive: boolean;
  staleLockDetected: boolean;
  queuedCount: number;
  attemptedToday: number;
  appliedToday: number;
  failedToday: number;
}> {
  await connectToDatabase();
  const { ActivityLog: ActivityLogModel } = await import("@/models/ActivityLog");
  const { AutoApplyLock } = await import("@/models/AutoApplyLock");
  const todayStart = startOfTodayUTC();
  const { heartbeatTtlMinutes } = getWorkerConfig();

  const [lockDoc, queuedCount, appliedToday, failedToday] = await Promise.all([
    AutoApplyLock.findOne({ key: "auto-apply" }).lean(),
    Match.countDocuments({ user: userId._id, applicationStatus: { $in: ["queued", "approved"] } }),
    ActivityLogModel.countDocuments({ type: "apply", status: "success", createdAt: { $gte: todayStart } }),
    ActivityLogModel.countDocuments({ type: "apply", status: "failed", createdAt: { $gte: todayStart } })
  ]);

  const lastHeartbeat = lockDoc?.heartbeatAt ?? null;
  const lockActive = Boolean(lockDoc?.locked);
  const staleLockDetected =
    lastHeartbeat == null ? true : Date.now() - new Date(lastHeartbeat).getTime() > heartbeatTtlMinutes * 60_000;

  return {
    workerRunning: lockActive,
    lastHeartbeatAt: lastHeartbeat ?? null,
    lastRunStartedAt: lockDoc?.lastRunStartedAt ?? null,
    lastRunCompletedAt: lockDoc?.lastRunCompletedAt ?? null,
    lockActive,
    staleLockDetected,
    queuedCount,
    attemptedToday: appliedToday + failedToday,
    appliedToday,
    failedToday
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
