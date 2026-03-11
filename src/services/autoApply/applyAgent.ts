import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { Match } from "@/models/Match";
import { ActivityLog } from "@/models/ActivityLog";
import { getValidJobUrl, isValidJobUrl } from "@/lib/urlValidation";
import { getApplyConfig } from "@/config/applyConfig";
import { getTailoringConfig } from "@/config/tailoringConfig";
import {
  hasTailoredContentForMatch,
  getTailoredApplicationByMatchId,
  markTailoredApplicationUsedByMatch
} from "@/services/tailoredApplicationService";
import { sendApplicationSuccess, sendBatchApplicationSummary, isTelegramConfigured } from "@/services/telegram";
import { logActivity } from "@/services/activityLogger";
import {
  isSupportedApplySource,
  userToApplicationProfile,
  type AutoApplyOptions,
  type AutoApplyResult,
  type ApplyAttemptContext,
  type ApplicationMethod
} from "./types";
import { applyWithGreenhouse } from "./greenhouseApply";
import { applyWithLever } from "./leverApply";
import { applyWithWorkable } from "./workableApply";

function sourceToMethod(source: string): ApplicationMethod | null {
  if (source === "Greenhouse") return "greenhouse";
  if (source === "Lever") return "lever";
  if (source === "Workable") return "workable";
  return null;
}

/** Start of today UTC for daily cap. */
function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Run auto-apply: only matches in queued or approved, supported source, valid URL.
 * Respects AUTO_APPLY_ENABLED, score threshold, max per run, max per day, requireReviewForSources.
 */
export async function runAutoApply(
  options: AutoApplyOptions = {}
): Promise<AutoApplyResult> {
  const config = getApplyConfig();
  const dryRun = options.dryRun ?? config.dryRunDefault;
  const maxApplications = Math.min(
    options.maxApplications ?? config.maxApplicationsPerRun,
    config.maxApplicationsPerRun
  );
  const verbose = options.verbose ?? true;

  if (!config.autoApplyEnabled && !dryRun) {
    if (verbose) console.log("[JobRadar] Auto-apply disabled (AUTO_APPLY_ENABLED=false)");
    await logActivity({ type: "apply", status: "skipped", message: "Auto-apply disabled by config" });
    return { queued: 0, applied: 0, failed: 0, needsReview: 0, skipped: 0, results: [] };
  }

  await connectToDatabase();
  const user = await getOrCreateDefaultUser();
  const profile = userToApplicationProfile(user);

  const appliedToday = await ActivityLog.countDocuments({
    type: "apply",
    status: "success",
    createdAt: { $gte: startOfToday() }
  });
  const remainingToday = Math.max(0, config.maxApplicationsPerDay - appliedToday);
  const cap = Math.min(maxApplications, remainingToday);
  if (cap === 0 && !dryRun) {
    if (verbose) console.log("[JobRadar] Auto-apply daily cap reached");
    await logActivity({ type: "apply", status: "info", message: "Daily cap reached", details: { appliedToday } });
    return { queued: 0, applied: 0, failed: 0, needsReview: 0, skipped: 0, results: [] };
  }

  const matches = await Match.find({
    user: user._id,
    applicationStatus: { $in: ["queued", "approved"] }
  })
    .populate("job")
    .sort({ score: -1 })
    .limit((dryRun ? maxApplications : cap) * 2)
    .lean();

  const result: AutoApplyResult = {
    queued: 0,
    applied: 0,
    failed: 0,
    needsReview: 0,
    skipped: 0,
    results: []
  };

  const toProcess: Array<{ match: typeof matches[0]; job: NonNullable<typeof matches[0]["job"]> }> = [];
  const limit = dryRun ? maxApplications : cap;
  const tailoringConfig = getTailoringConfig();
  for (const m of matches) {
    const job = m.job as unknown as { _id: unknown; source: string; title: string; company: string; url?: string };
    if (!job || typeof job !== "object") continue;
    if (tailoringConfig.requireTailoringBeforeApply) {
      const hasTailoring = await hasTailoredContentForMatch(m._id, user._id);
      if (!hasTailoring) {
        await Match.updateOne(
          { _id: m._id },
          { $set: { applicationStatus: "ready_for_review" } }
        );
        result.skipped += 1;
        result.results.push({
          jobId: String(job._id),
          title: job.title,
          company: job.company,
          source: job.source,
          status: "skipped",
          failureReason: "Tailored content required; moved to ready_for_review"
        });
        if (verbose) console.log("[JobRadar] Auto-apply skip: tailoring required, moved to ready_for_review", job.title);
        continue;
      }
    }
    if (config.requireReviewForSources.includes(job.source) && m.applicationStatus !== "approved") {
      result.skipped += 1;
      result.results.push({
        jobId: String(job._id),
        title: job.title,
        company: job.company,
        source: job.source,
        status: "skipped",
        failureReason: "Source requires review approval first"
      });
      continue;
    }
    if (!isSupportedApplySource(job.source)) {
      result.skipped += 1;
      result.results.push({
        jobId: String(job._id),
        title: job.title,
        company: job.company,
        source: job.source,
        status: "skipped",
        failureReason: "Unsupported source"
      });
      if (verbose) console.log("[JobRadar] Auto-apply skip: unsupported source", job.source);
      continue;
    }
    const url = getValidJobUrl(job);
    if (!url || !isValidJobUrl(url)) {
      result.skipped += 1;
      result.results.push({
        jobId: String(job._id),
        title: job.title,
        company: job.company,
        source: job.source,
        status: "skipped",
        failureReason: "Invalid or missing URL"
      });
      if (verbose) console.log("[JobRadar] Auto-apply skip: invalid URL");
      continue;
    }
    if (m.applicationStatus === "applied" && m.autoApplied) {
      result.skipped += 1;
      result.results.push({
        jobId: String(job._id),
        title: job.title,
        company: job.company,
        source: job.source,
        status: "skipped",
        failureReason: "Already applied"
      });
      continue;
    }
    const method = sourceToMethod(job.source);
    if (!method) continue;
    toProcess.push({ match: m, job });
    if (toProcess.length >= limit) break;
  }

  result.queued = toProcess.length;
  if (verbose) console.log("[JobRadar] Auto-apply queued", result.queued, "dryRun:", dryRun);
  await logActivity({
    type: "apply",
    status: "started",
    message: "Auto-apply run started",
    details: { dryRun, queued: toProcess.length, maxApplications: limit }
  });

  const appliedItems: Array<{ title: string; company: string }> = [];

  for (const { match, job } of toProcess) {
    const jobId = String(job._id);
    const matchId = String(match._id);
    const method = sourceToMethod(job.source)!;

    const matchProfile = { ...profile };
    const tailored = await getTailoredApplicationByMatchId(matchId, (user as { _id: { toString(): string } })._id.toString());
    if (tailored && (tailored.status === "approved" || tailored.status === "used") && tailored.coverLetter) {
      matchProfile.tailoredCoverLetter = tailored.coverLetter;
      matchProfile.tailoredRecruiterMessage = tailored.recruiterMessage ?? undefined;
    }

    if (dryRun) {
      result.applied += 1;
      result.results.push({
        jobId,
        title: job.title,
        company: job.company,
        source: job.source,
        status: "applied",
        tailoredUsed: Boolean(matchProfile.tailoredCoverLetter)
      });
      appliedItems.push({ title: job.title, company: job.company });
      if (verbose) console.log("[JobRadar] Auto-apply (dry run) would apply:", job.title, job.company);
      await logActivity({
        type: "apply",
        source: job.source,
        jobId,
        matchId,
        status: "info",
        message: "Dry run: ready_to_submit",
        details: { title: job.title, company: job.company, method }
      });
      continue;
    }

    await Match.updateOne(
      { _id: match._id },
      { $set: { applicationStatus: "applying" } }
    );
    await logActivity({
      type: "apply",
      source: job.source,
      jobId,
      matchId,
      status: "started",
      message: "Apply started",
      details: { title: job.title, company: job.company }
    });

    const ctx: ApplyAttemptContext = {
      job: job as ApplyAttemptContext["job"],
      match: match as ApplyAttemptContext["match"],
      user,
      profile: matchProfile,
      method
    };

    const APPLY_TIMEOUT_MS = 60_000;
    let applyResult: { success: boolean; needsReview?: boolean; failureReason?: string | null };
    try {
      const run = () =>
        method === "greenhouse"
          ? applyWithGreenhouse(ctx)
          : method === "lever"
            ? applyWithLever(ctx)
            : method === "workable"
              ? applyWithWorkable(ctx)
              : Promise.resolve({ success: false, failureReason: "Unknown method" as string | null });
      const timeoutResult = new Promise<{ success: false; needsReview: true; failureReason: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, needsReview: true, failureReason: "Apply timed out" }), APPLY_TIMEOUT_MS)
      );
      applyResult = await Promise.race([run(), timeoutResult]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      applyResult = { success: false, needsReview: true, failureReason: msg };
    }

    const now = new Date();
    if (applyResult.success) {
      const usedTailored = Boolean(matchProfile.tailoredCoverLetter);
      await Match.updateOne(
        { _id: match._id },
        {
          $set: {
            applicationStatus: "applied",
            autoApplied: true,
            appliedAt: now,
            applicationMethod: method,
            failureReason: null,
            status: "applied",
            tailoredUsedInApply: usedTailored
          }
        }
      );
      const sent = await sendApplicationSuccess({
        title: job.title,
        company: job.company,
        source: job.source,
        timestamp: now.toISOString()
      });
      if (sent) {
        await Match.updateOne({ _id: match._id }, { $set: { telegramSent: true } });
        await logActivity({ type: "telegram", status: "success", message: "Application success notification sent", jobId, matchId });
      }
      await markTailoredApplicationUsedByMatch(match._id, user._id);
      result.applied += 1;
      result.results.push({
        jobId,
        title: job.title,
        company: job.company,
        source: job.source,
        status: "applied",
        tailoredUsed: usedTailored
      });
      appliedItems.push({ title: job.title, company: job.company });
      if (verbose) console.log("[JobRadar] Auto-apply success:", job.title, job.company);
      await logActivity({
        type: "apply",
        source: job.source,
        jobId,
        matchId,
        status: "success",
        message: "Applied successfully",
        details: { title: job.title, company: job.company }
      });
    } else if (applyResult.needsReview) {
      await Match.updateOne(
        { _id: match._id },
        {
          $set: {
            applicationStatus: "needs_review",
            failureReason: applyResult.failureReason ?? "Unknown"
          }
        }
      );
      result.needsReview += 1;
      result.results.push({
        jobId,
        title: job.title,
        company: job.company,
        source: job.source,
        status: "needs_review",
        failureReason: applyResult.failureReason
      });
      if (verbose) console.log("[JobRadar] Auto-apply needs_review:", job.title, applyResult.failureReason);
      await logActivity({
        type: "apply",
        source: job.source,
        jobId,
        matchId,
        status: "failed",
        message: "Needs review",
        details: { title: job.title, failureReason: applyResult.failureReason }
      });
    } else {
      await Match.updateOne(
        { _id: match._id },
        {
          $set: {
            applicationStatus: "failed",
            failureReason: applyResult.failureReason ?? "Unknown"
          }
        }
      );
      result.failed += 1;
      result.results.push({
        jobId,
        title: job.title,
        company: job.company,
        source: job.source,
        status: "failed",
        failureReason: applyResult.failureReason
      });
      if (verbose) console.log("[JobRadar] Auto-apply failed:", job.title, applyResult.failureReason);
      await logActivity({
        type: "apply",
        source: job.source,
        jobId,
        matchId,
        status: "failed",
        message: "Apply failed",
        details: { title: job.title, failureReason: applyResult.failureReason }
      });
    }
  }

  if (appliedItems.length > 1 && isTelegramConfigured() && !dryRun) {
    await sendBatchApplicationSummary({ total: appliedItems.length, items: appliedItems });
  }

  return result;
}
