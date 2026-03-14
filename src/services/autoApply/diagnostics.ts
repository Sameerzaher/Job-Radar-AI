import { connectToDatabase } from "@/lib/db";
import { getApplyConfig } from "@/config/applyConfig";
import { Match } from "@/models/Match";
import { AutoApplyLock } from "@/models/AutoApplyLock";

export interface AutoApplyDiagnostics {
  autoApplyEnabled: boolean;
  dryRunDefault: boolean;
  queuedCount: number;
  approvedCount: number;
  needsReviewCount: number;
  lockState: {
    locked: boolean;
    lockedAt?: Date | null;
    lockedBy?: string | null;
    heartbeatAt?: Date | null;
    lastRunStartedAt?: Date | null;
    lastRunCompletedAt?: Date | null;
    lastRunStatus?: string | null;
    lastError?: string | null;
    lastRunSummary?: Record<string, unknown> | null;
    workerPid?: string | null;
  } | null;
}

export async function getAutoApplyDiagnostics(userId: { _id: unknown }): Promise<AutoApplyDiagnostics> {
  await connectToDatabase();
  const config = getApplyConfig();

  const [queuedCount, approvedCount, needsReviewCount, lockDoc] = await Promise.all([
    Match.countDocuments({ user: userId._id, applicationStatus: "queued" }),
    Match.countDocuments({ user: userId._id, applicationStatus: "approved" }),
    Match.countDocuments({ user: userId._id, applicationStatus: "needs_review" }),
    AutoApplyLock.findOne({ key: "auto-apply" }).lean()
  ]);

  const lockState = lockDoc
    ? {
        locked: Boolean(lockDoc.locked),
        lockedAt: lockDoc.lockedAt ?? null,
        lockedBy: lockDoc.lockedBy ?? null,
        heartbeatAt: lockDoc.heartbeatAt ?? null,
        lastRunStartedAt: lockDoc.lastRunStartedAt ?? null,
        lastRunCompletedAt: lockDoc.lastRunCompletedAt ?? null,
        lastRunStatus: (lockDoc.lastRunStatus as string | undefined) ?? null,
        lastError: (lockDoc as { lastError?: string }).lastError ?? null,
        lastRunSummary: (lockDoc.lastRunSummary as Record<string, unknown> | undefined) ?? null,
        workerPid: (lockDoc as { workerPid?: string }).workerPid ?? null
      }
    : null;

  return {
    autoApplyEnabled: config.autoApplyEnabled,
    dryRunDefault: config.dryRunDefault,
    queuedCount,
    approvedCount,
    needsReviewCount,
    lockState
  };
}

