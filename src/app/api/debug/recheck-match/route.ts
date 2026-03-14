import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";
import { Job } from "@/models/Job";
import { getOrCreateDefaultUser } from "@/services/userService";
import { evaluateJobForAutoApply } from "@/services/rules/rulesEngine";
import { recheckSkippedRulesMatchesForSeniority } from "@/services/jobService";
import { isSeniorLevelJob, isSeniorityOnlyFailureReason } from "@/services/rules/rulesConfig";
import { resolveQueueStatusByUrl, getAutoQueueIntendedStatus } from "@/services/autoApply/queueEligibility";

/**
 * POST /api/debug/recheck-match
 * Re-run rule evaluation for a match (by matchId or jobTitle). Returns rules result, reasons, and whether seniority blocked (always false now).
 * Body: { matchId?: string, jobTitle?: string, repair?: boolean }
 * - repair: true = re-evaluate all skipped_rules matches whose failureReason is seniority-only and move to queued/ready_for_review.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const matchId = typeof body.matchId === "string" ? body.matchId.trim() : undefined;
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : undefined;
    const repair = body.repair === true;

    if (!matchId && !jobTitle && !repair) {
      return NextResponse.json(
        { ok: false, error: "Provide matchId, jobTitle, or repair: true in body" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await getOrCreateDefaultUser();

    let repairResult: { updated: number; queued: number; readyForReview: number } | undefined;
    if (repair) {
      repairResult = await recheckSkippedRulesMatchesForSeniority(user);
    }

    if (!matchId && !jobTitle) {
      return NextResponse.json({
        ok: true,
        repair: true,
        repairResult: repairResult ?? { updated: 0, queued: 0, readyForReview: 0 }
      });
    }

    let match: { _id: unknown; job: unknown; score: number; missingSkills?: string[]; applicationStatus?: string; failureReason?: string | null } | null = null;

    if (matchId) {
      const doc = await Match.findOne({ _id: matchId, user: user._id }).populate("job").lean();
      match = doc as typeof match;
    } else if (jobTitle) {
      const job = await Job.findOne({ title: new RegExp(jobTitle, "i") }).lean();
      if (!job) {
        return NextResponse.json(
          { ok: false, error: `No job found with title matching "${jobTitle}"` },
          { status: 404 }
        );
      }
      const doc = await Match.findOne({ job: job._id, user: user._id }).populate("job").lean();
      match = doc as typeof match;
      if (!match) {
        return NextResponse.json(
          { ok: false, error: `No match found for job "${jobTitle}"` },
          { status: 404 }
        );
      }
    }

    if (!match || !match.job) {
      return NextResponse.json(
        { ok: false, error: "Match not found or job missing" },
        { status: 404 }
      );
    }

    const job = match.job as {
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

    const rulesResult = await evaluateJobForAutoApply(
      user,
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

    const intendedStatus = getAutoQueueIntendedStatus(
      { source: job.source ?? "", autoApplySupported: job.autoApplySupported },
      match.score
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

    let finalStatusAfterRecompute = resolved.applicationStatus;
    if (resolved.applicationStatus === "queued" && !rulesResult.eligible) {
      finalStatusAfterRecompute = "ready_for_review";
    } else if (resolved.applicationStatus === "queued" && rulesResult.eligible) {
      finalStatusAfterRecompute = "queued";
    }

    const seniorLevel = isSeniorLevelJob(job);
    const seniorityBlocked = false; // seniority never blocks after rule removal
    const previousFailureWasSeniorityOnly = isSeniorityOnlyFailureReason(match.failureReason ?? null);

    return NextResponse.json({
      ok: true,
      ...(repairResult && { repairResult }),
      matchId: String(match._id),
      jobTitle: job.title ?? null,
      company: job.company ?? null,
      score: match.score,
      currentApplicationStatus: match.applicationStatus ?? null,
      currentFailureReason: match.failureReason ?? null,
      rulesResult: {
        eligible: rulesResult.eligible,
        status: rulesResult.status,
        reasons: rulesResult.reasons
      },
      seniorityBlocked,
      seniorLevelJob: seniorLevel,
      previousFailureWasSeniorityOnly,
      intendedStatusFromScore: intendedStatus,
      resolvedStatusByUrl: resolved.applicationStatus,
      finalStatusAfterRecompute
    });
  } catch (e) {
    console.error("[JobRadar] recheck-match error", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Recheck failed" },
      { status: 500 }
    );
  }
}
