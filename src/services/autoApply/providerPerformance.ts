/**
 * Provider performance metrics and live verification data.
 */

import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";
import { getApplyConfig } from "@/config/applyConfig";
import { getWorkerConfig } from "@/config/applyConfig";
import { AutoApplyLock } from "@/models/AutoApplyLock";

const SUPPORTED_PROVIDERS = ["Greenhouse", "Lever", "Workable"] as const;

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface ProviderStats {
  provider: string;
  attempted: number;
  applied: number;
  needs_review: number;
  skipped_unsupported: number;
  failed: number;
  successRate: number | null;
}

export interface LiveVerificationData {
  workerRunning: boolean;
  lastHeartbeatAt: Date | null;
  lastRunStartedAt: Date | null;
  lastRunCompletedAt: Date | null;
  currentMode: "live" | "dry_run";
  queueSize: number;
  appliedToday: number;
  needsReviewToday: number;
  skippedRulesToday: number;
  skippedUnsupportedToday: number;
  failedToday: number;
}

export interface RecentApplicationItem {
  matchId: string;
  jobId: string;
  title: string;
  company: string;
  provider: string;
  finalStatus: string;
  failureReason: string | null;
  appliedAt: Date | null;
  tailoredUsedInApply: boolean;
}

export interface FailureReasonByProvider {
  provider: string;
  reason: string;
  count: number;
}

/** Greenhouse-specific outcome classification for metrics. */
export interface GreenhouseOutcomeMetrics {
  submitAttempted: number;
  submitConfirmed: number;
  needsReviewAfterSubmit: number;
  blockedBeforeSubmit: number;
}

function isGreenhouseNeedsReviewAfterSubmit(failureReason: string | null | undefined): boolean {
  if (!failureReason) return false;
  const r = failureReason.toLowerCase();
  return (
    r.includes("success confirmation not detected") ||
    r.includes("validation error remained after fill") ||
    r.includes("validation errors after submit")
  );
}

function isGreenhouseBlockedBeforeSubmit(failureReason: string | null | undefined): boolean {
  if (!failureReason) return true; // no reason = assume blocked before submit
  const r = failureReason.toLowerCase();
  return (
    r.includes("submit button not found") ||
    r.includes("required checkbox") ||
    r.includes("unsupported required custom") ||
    r.includes("resume upload failed") ||
    r.includes("required field") ||
    r.includes("apply link or form not found") ||
    r.includes("captcha") ||
    r.includes("custom required") ||
    r.includes("mandatory checkbox") ||
    r.includes("custom question") ||
    r.includes("no job url") ||
    r.includes("invalid or non-greenhouse")
  );
}

export async function getLiveVerificationData(userId: { _id: unknown }): Promise<LiveVerificationData> {
  await connectToDatabase();
  const config = getApplyConfig();
  const todayStart = startOfTodayUTC();

  const [lockDoc, queueSize, appliedToday, needsReviewToday, skippedRulesToday, skippedUnsupportedToday, failedToday] =
    await Promise.all([
      AutoApplyLock.findOne({ key: "auto-apply" }).lean(),
      Match.countDocuments({ user: userId._id, applicationStatus: { $in: ["queued", "approved"] } }),
      Match.countDocuments({
        user: userId._id,
        applicationStatus: "applied",
        appliedAt: { $gte: todayStart }
      }),
      Match.countDocuments({
        user: userId._id,
        applicationStatus: "needs_review",
        updatedAt: { $gte: todayStart }
      }),
      Match.countDocuments({
        user: userId._id,
        applicationStatus: "skipped_rules",
        updatedAt: { $gte: todayStart }
      }),
      Match.countDocuments({
        user: userId._id,
        applicationStatus: "skipped_unsupported",
        updatedAt: { $gte: todayStart }
      }),
      Match.countDocuments({
        user: userId._id,
        applicationStatus: "failed",
        updatedAt: { $gte: todayStart }
      })
    ]);

  const lastHeartbeat = lockDoc?.heartbeatAt ?? null;
  const { heartbeatTtlMinutes } = getWorkerConfig();
  const workerRunning =
    Boolean(lockDoc?.locked) ||
    (lastHeartbeat != null && Date.now() - new Date(lastHeartbeat).getTime() <= heartbeatTtlMinutes * 60_000);

  return {
    workerRunning,
    lastHeartbeatAt: lastHeartbeat ?? null,
    lastRunStartedAt: lockDoc?.lastRunStartedAt ?? null,
    lastRunCompletedAt: lockDoc?.lastRunCompletedAt ?? null,
    currentMode: config.dryRunDefault ? "dry_run" : "live",
    queueSize,
    appliedToday,
    needsReviewToday,
    skippedRulesToday,
    skippedUnsupportedToday,
    failedToday
  };
}

export async function getProviderPerformance(userId: { _id: unknown }): Promise<ProviderStats[]> {
  await connectToDatabase();
  const todayStart = startOfTodayUTC();

  const aggregated = await Match.aggregate([
    { $match: { user: userId._id } },
    { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "jobDoc" } },
    { $unwind: "$jobDoc" },
    {
      $match: {
        "jobDoc.source": { $in: SUPPORTED_PROVIDERS },
        $or: [
          { applicationStatus: "applied", appliedAt: { $gte: todayStart } },
          { applicationStatus: "failed", updatedAt: { $gte: todayStart } },
          { applicationStatus: "needs_review", updatedAt: { $gte: todayStart } },
          { applicationStatus: "skipped_unsupported", updatedAt: { $gte: todayStart } }
        ]
      }
    },
    {
      $group: {
        _id: "$jobDoc.source",
        attempted: {
          $sum: {
            $cond: [
              { $in: ["$applicationStatus", ["applied", "failed", "needs_review"]] },
              1,
              0
            ]
          }
        },
        applied: { $sum: { $cond: [{ $eq: ["$applicationStatus", "applied"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$applicationStatus", "failed"] }, 1, 0] } },
        needs_review: { $sum: { $cond: [{ $eq: ["$applicationStatus", "needs_review"] }, 1, 0] } },
        skipped_unsupported: { $sum: { $cond: [{ $eq: ["$applicationStatus", "skipped_unsupported"] }, 1, 0] } }
      }
    }
  ]);

  const statsMap = new Map<string, ProviderStats>();
  for (const p of SUPPORTED_PROVIDERS) {
    statsMap.set(p, {
      provider: p,
      attempted: 0,
      applied: 0,
      needs_review: 0,
      skipped_unsupported: 0,
      failed: 0,
      successRate: null
    });
  }
  for (const row of aggregated) {
    const provider = row._id ?? "Unknown";
    const attempted = Number(row.attempted ?? 0);
    const applied = Number(row.applied ?? 0);
    const failed = Number(row.failed ?? 0);
    const needs_review = Number(row.needs_review ?? 0);
    const skipped_unsupported = Number(row.skipped_unsupported ?? 0);
    const successRate = attempted > 0 ? Math.round((applied / attempted) * 100) : null;
    statsMap.set(provider, {
      provider,
      attempted,
      applied,
      needs_review,
      skipped_unsupported,
      failed,
      successRate
    });
  }
  return [...statsMap.values()];
}

export async function getRecentApplications(
  userId: { _id: unknown },
  limit: number = 50
): Promise<RecentApplicationItem[]> {
  await connectToDatabase();

  const matches = await Match.find({
    user: userId._id,
    applicationStatus: { $in: ["applied", "failed", "needs_review"] }
  })
    .populate("job")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const items: RecentApplicationItem[] = [];
  for (const m of matches) {
    const job = m.job as unknown as { _id: unknown; title?: string; company?: string; source?: string };
    if (!job) continue;
    items.push({
      matchId: String(m._id),
      jobId: String(job._id),
      title: job.title ?? "",
      company: job.company ?? "",
      provider: job.source ?? "—",
      finalStatus: m.applicationStatus ?? "—",
      failureReason: m.failureReason ?? null,
      appliedAt: m.appliedAt ?? null,
      tailoredUsedInApply: Boolean(m.tailoredUsedInApply)
    });
  }
  return items;
}

/** Recent application attempts for Greenhouse only (for operations table). */
export async function getRecentGreenhouseAttempts(
  userId: { _id: unknown },
  limit: number = 50
): Promise<RecentApplicationItem[]> {
  const all = await getRecentApplications(userId, limit * 2);
  const greenhouse = all.filter((item) => item.provider === "Greenhouse").slice(0, limit);
  return greenhouse;
}

/** Greenhouse outcome metrics (today): submit attempted, submit confirmed, needs_review after submit, blocked before submit. */
export async function getGreenhouseOutcomeMetrics(userId: { _id: unknown }): Promise<GreenhouseOutcomeMetrics> {
  await connectToDatabase();
  const todayStart = startOfTodayUTC();

  const matches = await Match.find({
    user: userId._id,
    $or: [
      { applicationStatus: "applied", appliedAt: { $gte: todayStart } },
      { applicationStatus: "needs_review", updatedAt: { $gte: todayStart } }
    ]
  })
    .populate("job")
    .lean();

  let submitConfirmed = 0;
  let needsReviewAfterSubmit = 0;
  let blockedBeforeSubmit = 0;

  for (const m of matches) {
    const job = m.job as unknown as { source?: string };
    if (job?.source !== "Greenhouse") continue;
    const reason = m.failureReason ?? null;
    if (m.applicationStatus === "applied") {
      submitConfirmed += 1;
    } else if (m.applicationStatus === "needs_review") {
      if (isGreenhouseNeedsReviewAfterSubmit(reason)) {
        needsReviewAfterSubmit += 1;
      } else {
        blockedBeforeSubmit += 1;
      }
    }
  }

  const submitAttempted = submitConfirmed + needsReviewAfterSubmit;

  return {
    submitAttempted,
    submitConfirmed,
    needsReviewAfterSubmit,
    blockedBeforeSubmit
  };
}

export type ApplyProfileMetrics = {
  profileName: string;
  applied: number;
  failed: number;
  needsReview: number;
  successRate: number | null;
};

/** Applications by apply profile (for operations analytics). */
export async function getApplicationsByApplyProfile(userId: {
  _id: unknown;
}): Promise<ApplyProfileMetrics[]> {
  await connectToDatabase();
  const matches = await Match.find({
    user: userId._id,
    applicationStatus: { $in: ["applied", "failed", "needs_review"] }
  }).lean();

  const byProfile = new Map<
    string,
    { applied: number; failed: number; needsReview: number }
  >();
  for (const m of matches) {
    const name = (m as { applyProfileName?: string | null }).applyProfileName?.trim() || "User profile";
    if (!byProfile.has(name)) byProfile.set(name, { applied: 0, failed: 0, needsReview: 0 });
    const row = byProfile.get(name)!;
    if (m.applicationStatus === "applied") row.applied += 1;
    else if (m.applicationStatus === "failed") row.failed += 1;
    else row.needsReview += 1;
  }
  const result: ApplyProfileMetrics[] = [];
  for (const [profileName, row] of byProfile.entries()) {
    const total = row.applied + row.failed + row.needsReview;
    result.push({
      profileName,
      applied: row.applied,
      failed: row.failed,
      needsReview: row.needsReview,
      successRate: total > 0 ? Math.round((row.applied / total) * 100) : null
    });
  }
  return result.sort((a, b) => (b.applied + b.failed + b.needsReview) - (a.applied + a.failed + a.needsReview));
}

export async function getFailureReasonsByProvider(userId: { _id: unknown }): Promise<FailureReasonByProvider[]> {
  await connectToDatabase();
  const todayStart = startOfTodayUTC();

  const aggregated = await Match.aggregate([
    { $match: { user: userId._id, applicationStatus: { $in: ["failed", "needs_review"] }, updatedAt: { $gte: todayStart } } },
    { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "jobDoc" } },
    { $unwind: "$jobDoc" },
    {
      $group: {
        _id: { provider: "$jobDoc.source", reason: { $ifNull: ["$failureReason", "(no reason)"] } },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return aggregated.map((row: { _id: { provider: string; reason: string }; count: number }) => ({
    provider: row._id.provider ?? "Unknown",
    reason: row._id.reason ?? "(no reason)",
    count: row.count
  }));
}

const SUCCESS_RATE_READY = 60;
const SUCCESS_RATE_LOW = 40;
const MIN_ATTEMPTS_FOR_READY = 3;

export function getProviderHealthRecommendation(stats: ProviderStats): string {
  if (stats.provider === "Lever") {
    if (stats.attempted >= MIN_ATTEMPTS_FOR_READY && (stats.successRate ?? 0) >= SUCCESS_RATE_READY) {
      return "Lever is ready for live auto-apply.";
    }
    return "Lever: consider review-only until selectors are hardened.";
  }
  if (stats.provider === "Workable") {
    const rate = stats.successRate ?? 0;
    if (stats.attempted >= MIN_ATTEMPTS_FOR_READY && rate >= SUCCESS_RATE_READY) {
      return "Workable is ready for live auto-apply.";
    }
    if (stats.attempted > 0 && rate < SUCCESS_RATE_LOW) {
      return "Workable has low success rate; keep manual/review mode.";
    }
    return "Workable: monitor success rate before going full live.";
  }
  if (stats.provider === "Greenhouse") {
    if (stats.attempted >= MIN_ATTEMPTS_FOR_READY && (stats.successRate ?? 0) >= SUCCESS_RATE_READY) {
      return "Greenhouse is ready for live auto-apply.";
    }
    if (stats.attempted === 0) {
      return "Greenhouse: no attempts today; ready when you have queue.";
    }
    return "Greenhouse: monitor success rate.";
  }
  return `${stats.provider}: review metrics before enabling live.`;
}
