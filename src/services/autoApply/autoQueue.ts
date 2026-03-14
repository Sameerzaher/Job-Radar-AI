/**
 * Automatically queue eligible Greenhouse matches for auto-apply (no manual approval).
 * Only Greenhouse with supported URL, score >= threshold, and rules pass get queued.
 */

import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";
import { getApplyConfig } from "@/config/applyConfig";
import { evaluateJobForAutoApply } from "@/services/rules/rulesEngine";
import { logActivity } from "@/services/activityLogger";

const LOG = "[JobRadar] AutoQueue:";

export type AutoQueueResult =
  | { queued: true }
  | { queued: false; reason: "provider" | "unsupported_url" | "low_score" | "status" | "rules" };

export interface AutoQueueEligibleMatchesResult {
  queued: number;
  skippedByRules: number;
  skippedByUrl: number;
  skippedByLowScore: number;
  skippedByProvider: number;
  skippedByStatus: number;
}

type JobForAutoQueue = {
  _id: unknown;
  source?: string;
  title?: string;
  company?: string;
  location?: string;
  postedAt?: Date | null;
  foundAt?: Date | null;
  autoApplySupported?: boolean;
  urlClassification?: string;
};

type MatchForAutoQueue = {
  _id: unknown;
  score: number;
  applicationStatus?: string;
  job: unknown;
  missingSkills?: string[];
};

/**
 * Check if a single match is eligible and, if so, set applicationStatus = "queued" and queuedAt = now.
 * Only Greenhouse; verifies supported URL, threshold, and rules (including company cooldown).
 */
export async function autoQueueEligibleMatch(
  match: MatchForAutoQueue,
  job: JobForAutoQueue | null,
  userId: { _id: unknown }
): Promise<AutoQueueResult> {
  if (!job) return { queued: false, reason: "unsupported_url" };

  const { autoApplyScoreThreshold } = getApplyConfig();

  if (job.source !== "Greenhouse") {
    return { queued: false, reason: "provider" };
  }

  if (job.autoApplySupported !== true || job.urlClassification !== "supported_apply_url") {
    console.log(
      `${LOG} auto-queue skipped by unsupported URL | title=${job.title ?? "—"} company=${job.company ?? "—"}`
    );
    return { queued: false, reason: "unsupported_url" };
  }

  const status = match.applicationStatus ?? "new";
  if (status !== "new" && status !== "ready_for_review") {
    return { queued: false, reason: "status" };
  }

  if (match.score < autoApplyScoreThreshold) {
    console.log(
      `${LOG} auto-queue skipped by low score | score=${match.score} threshold=${autoApplyScoreThreshold} title=${job.title ?? "—"}`
    );
    return { queued: false, reason: "low_score" };
  }

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
    { missingSkills: match.missingSkills, score: match.score }
  );

  if (!ruleResult.eligible) {
    console.log(
      `${LOG} auto-queue skipped by rules | title=${job.title ?? "—"} company=${job.company ?? "—"} reasons=${ruleResult.reasons.join("; ")}`
    );
    await Match.updateOne(
      { _id: match._id },
      {
        $set: {
          applicationStatus: "skipped_rules",
          failureReason: ruleResult.reasons[0] ?? "Rules engine blocked"
        }
      }
    );
    return { queued: false, reason: "rules" };
  }

  const now = new Date();
  await Match.updateOne(
    { _id: match._id },
    { $set: { applicationStatus: "queued", queuedAt: now, failureReason: null } }
  );
  console.log(`${LOG} auto-queue success | title=${job.title ?? "—"} company=${job.company ?? "—"} matchId=${match._id}`);
  return { queued: true };
}

/**
 * Find all matches for user with applicationStatus in [new, ready_for_review],
 * populate job, and run autoQueueEligibleMatch on each. Returns counts.
 */
export async function autoQueueEligibleMatches(userId: { _id: unknown }): Promise<AutoQueueEligibleMatchesResult> {
  await connectToDatabase();

  const result: AutoQueueEligibleMatchesResult = {
    queued: 0,
    skippedByRules: 0,
    skippedByUrl: 0,
    skippedByLowScore: 0,
    skippedByProvider: 0,
    skippedByStatus: 0
  };

  const matches = await Match.find({
    user: userId._id,
    applicationStatus: { $in: ["new", "ready_for_review"] }
  })
    .populate("job")
    .lean();

  for (const m of matches) {
    const job = m.job as unknown as JobForAutoQueue;
    const match = m as unknown as MatchForAutoQueue;
    const r = await autoQueueEligibleMatch(match, job, userId);
    if (r.queued) result.queued += 1;
    else {
      if (r.reason === "rules") result.skippedByRules += 1;
      else if (r.reason === "unsupported_url") result.skippedByUrl += 1;
      else if (r.reason === "low_score") result.skippedByLowScore += 1;
      else if (r.reason === "provider") result.skippedByProvider += 1;
      else result.skippedByStatus += 1;
    }
  }

  if (result.queued > 0 || result.skippedByRules > 0 || result.skippedByUrl > 0 || result.skippedByLowScore > 0) {
    await logActivity({
      type: "apply",
      status: "info",
      message: "Auto-queue pass",
      details: {
        userId: userId._id,
        queued: result.queued,
        skippedByRules: result.skippedByRules,
        skippedByUrl: result.skippedByUrl,
        skippedByLowScore: result.skippedByLowScore,
        skippedByProvider: result.skippedByProvider,
        skippedByStatus: result.skippedByStatus
      }
    });
  }

  return result;
}
