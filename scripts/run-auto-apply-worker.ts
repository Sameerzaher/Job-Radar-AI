import "dotenv/config";
import os from "os";
import cron from "node-cron";
import { connectToDatabase } from "@/lib/db";
import { AutoApplyLock } from "@/models/AutoApplyLock";
import { runAutoApply } from "@/services/autoApply/applyAgent";

const CRON_SCHEDULE = "*/10 * * * *"; // Every 10 minutes
const WORKER_KEY = "auto-apply";
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute

let shuttingDown = false;
let heartbeatTimer: NodeJS.Timeout | null = null;

async function acquireLock(): Promise<boolean> {
  await connectToDatabase();
  const now = new Date();
  const hostname = os.hostname();
  const pid = process.pid;
  const lockedBy = `${hostname}:${pid}`;

  const res = await AutoApplyLock.findOneAndUpdate(
    {
      key: WORKER_KEY,
      $or: [{ locked: false }, { heartbeatAt: { $lt: new Date(now.getTime() - 20 * 60_000) } }]
    },
    {
      $set: {
        key: WORKER_KEY,
        locked: true,
        lockedAt: now,
        lockedBy,
        heartbeatAt: now,
        lastRunStartedAt: now
      }
    },
    { upsert: true, new: true }
  ).lean();

  const acquired = Boolean(res && res.lockedBy === lockedBy);
  if (acquired) {
    console.log("[JobRadar] Auto-apply worker lock acquired by", lockedBy);
  } else {
    console.log("[JobRadar] Auto-apply worker: another instance holds the lock");
  }
  return acquired;
}

async function releaseLock(): Promise<void> {
  const hostname = os.hostname();
  const pid = process.pid;
  const lockedBy = `${hostname}:${pid}`;
  try {
    await AutoApplyLock.updateOne(
      { key: WORKER_KEY, lockedBy },
      { $set: { locked: false, lockedBy: null, lockedAt: null } }
    );
    console.log("[JobRadar] Auto-apply worker lock released by", lockedBy);
  } catch (err) {
    console.error("[JobRadar] Auto-apply worker: failed to release lock", err);
  }
}

async function updateHeartbeat(summary?: Record<string, unknown>): Promise<void> {
  const now = new Date();
  const hostname = os.hostname();
  const pid = process.pid;
  const lockedBy = `${hostname}:${pid}`;
  try {
    const update: any = { heartbeatAt: now };
    if (summary) Object.assign(update, summary);
    await AutoApplyLock.updateOne(
      { key: WORKER_KEY, lockedBy },
      { $set: update }
    );
  } catch (err) {
    console.error("[JobRadar] Auto-apply worker: failed to update heartbeat", err);
  }
}

async function runOnce(): Promise<void> {
  if (shuttingDown) return;

  const acquired = await acquireLock();
  if (!acquired) return;

  console.log("[JobRadar] Auto-apply worker run started");

  // Start heartbeat timer
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    void updateHeartbeat();
    console.log("[JobRadar] Auto-apply worker heartbeat");
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const result = await runAutoApply({ verbose: true });
    const now = new Date();
    await updateHeartbeat({
      lastRunCompletedAt: now,
      lastRunStatus: "success",
      lastRunSummary: {
        applied: result.applied,
        failed: result.failed,
        needsReview: result.needsReview,
        skipped: result.skipped,
        queued: result.queued
      }
    });
    console.log(
      "[JobRadar] Auto-apply worker run finished",
      JSON.stringify(result)
    );
  } catch (err) {
    console.error("[JobRadar] Auto-apply worker run failed", err);
    const now = new Date();
    await updateHeartbeat({
      lastRunCompletedAt: now,
      lastRunStatus: "error",
      lastRunSummary: {
        error: err instanceof Error ? err.message : String(err)
      }
    });
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    await releaseLock();
  }
}

function setupGracefulShutdown() {
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("[JobRadar] Auto-apply worker shutting down...");
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    await releaseLock();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function main(): void {
  console.log(
    `[JobRadar] Auto-apply worker booted. Schedule: ${CRON_SCHEDULE} (every 10 minutes)`
  );
  setupGracefulShutdown();

  // Schedule periodic runs
  cron.schedule(CRON_SCHEDULE, () => {
    console.log("[JobRadar] Auto-apply worker cron tick started");
    void runOnce();
  });

  // Run once on startup
  void runOnce();
}

main();

