/**
 * Production auto-apply worker: acquire lock, run runAutoApply, persist heartbeat and run summary.
 * Used by the dedicated worker process and by the manual trigger API.
 */

import { connectToDatabase } from "@/lib/db";
import { getApplyConfig, getWorkerConfig } from "@/config/applyConfig";
import { AutoApplyLock } from "@/models/AutoApplyLock";
import { runAutoApply } from "./applyAgent";
import type { AutoApplyResult } from "./types";

const LOG = "[JobRadarWorker]";

function workerId(): string {
  return `pid-${process.pid}`;
}

/**
 * Detect and release a stale lock (held longer than lockTimeoutMinutes).
 */
export async function releaseStaleLockIfNeeded(): Promise<boolean> {
  await connectToDatabase();
  const { lockTimeoutMinutes } = getWorkerConfig();
  const staleCutoff = new Date(Date.now() - lockTimeoutMinutes * 60 * 1000);

  const doc = await AutoApplyLock.findOne({ key: "auto-apply" });
  if (!doc || !doc.locked) return false;
  const heartbeat = doc.heartbeatAt ?? doc.lockedAt;
  if (!heartbeat || new Date(heartbeat) >= staleCutoff) return false;

  await AutoApplyLock.updateOne(
    { key: "auto-apply" },
    {
      $set: {
        locked: false,
        lockedBy: null,
        lastError: "Stale lock released (timeout)"
      }
    }
  );
  console.log(`${LOG} stale lock released (no heartbeat since ${heartbeat})`);
  return true;
}

/**
 * Run one auto-apply cycle: check config, release stale lock, acquire lock, run apply, persist results.
 */
export async function runAutoApplyWorker(): Promise<{
  ran: boolean;
  result?: AutoApplyResult;
  skippedReason?: string;
}> {
  const config = getApplyConfig();
  const dryRun = config.dryRunDefault;

  if (!config.autoApplyEnabled) {
    console.log(`${LOG} worker skipped because disabled (AUTO_APPLY_ENABLED=false)`);
    return { ran: false, skippedReason: "disabled" };
  }

  await connectToDatabase();

  const released = await releaseStaleLockIfNeeded();
  if (released) {
    console.log(`${LOG} stale lock detected and released`);
  }

  const { lockTimeoutMinutes } = getWorkerConfig();
  const staleCutoff = new Date(Date.now() - lockTimeoutMinutes * 60 * 1000);
  const now = new Date();
  const wid = workerId();

  await AutoApplyLock.findOneAndUpdate(
    { key: "auto-apply" },
    { $setOnInsert: { key: "auto-apply", locked: false } },
    { upsert: true }
  );

  const acquired = await AutoApplyLock.findOneAndUpdate(
    {
      key: "auto-apply",
      $or: [{ locked: false }, { heartbeatAt: { $lt: staleCutoff } }]
    },
    {
      $set: {
        locked: true,
        lockedBy: wid,
        lockedAt: now,
        heartbeatAt: now,
        lastRunStartedAt: now,
        workerPid: String(process.pid)
      }
    }
  );

  if (!acquired) {
    console.log(`${LOG} worker skipped because another run is active`);
    return { ran: false, skippedReason: "lock_held" };
  }

  console.log(`${LOG} lock acquired`);

  let result: AutoApplyResult;
  try {
    result = await runAutoApply({
      dryRun,
      maxApplications: config.maxApplicationsPerRun,
      verbose: true
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG} run failed:`, message);
    await AutoApplyLock.updateOne(
      { key: "auto-apply" },
      {
        $set: {
          locked: false,
          lockedBy: null,
          lastRunCompletedAt: new Date(),
          lastRunStatus: "error",
          lastError: message,
          heartbeatAt: new Date()
        }
      }
    );
    throw err;
  }

  const status =
    result.applied > 0 || result.failed > 0 || result.needsReview > 0
      ? result.failed > result.applied
        ? "failed"
        : "success"
      : "success";

  await AutoApplyLock.updateOne(
    { key: "auto-apply" },
    {
      $set: {
        locked: false,
        lockedBy: null,
        lastRunCompletedAt: new Date(),
        lastRunStatus: status,
        lastRunSummary: {
          queued: result.queued,
          applied: result.applied,
          failed: result.failed,
          needsReview: result.needsReview,
          skipped: result.skipped,
          skippedRules: result.skippedRules,
          skippedUnsupported: result.skippedUnsupported
        },
        heartbeatAt: new Date()
      },
      $unset: { lastError: 1 }
    }
  );

  const attempted = result.applied + result.failed + result.needsReview;
  const byProvider: Record<string, { attempted: number; applied: number; failed: number; needs_review: number }> = {};
  for (const r of result.results) {
    const src = r.source ?? "Unknown";
    if (!byProvider[src]) byProvider[src] = { attempted: 0, applied: 0, failed: 0, needs_review: 0 };
    if (r.status === "applied") {
      byProvider[src].attempted += 1;
      byProvider[src].applied += 1;
    } else if (r.status === "failed") {
      byProvider[src].attempted += 1;
      byProvider[src].failed += 1;
    } else if (r.status === "needs_review") {
      byProvider[src].attempted += 1;
      byProvider[src].needs_review += 1;
    }
  }
  console.log(
    `${LOG} run completed | attempted=${attempted} applied=${result.applied} failed=${result.failed} needs_review=${result.needsReview} dryRun=${dryRun}`
  );
  for (const [provider, counts] of Object.entries(byProvider)) {
    if (counts.attempted > 0) {
      console.log(
        `${LOG} provider ${provider} | attempted=${counts.attempted} applied=${counts.applied} failed=${counts.failed} needs_review=${counts.needs_review}`
      );
    }
  }
  return { ran: true, result };
}
