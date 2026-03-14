import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/services/userService";
import { runAutoApply } from "@/services/autoApply/applyAgent";
import { getTelegramDiagnostics } from "@/services/telegram";
import { SUPPORTED_PROVIDERS } from "@/services/autoApply/providerUrlClassifier";
import { getWorkerHealth } from "@/services/jobService";

/**
 * GET /api/debug/auto-apply
 * Force a single auto-apply cycle immediately (test mode).
 * Also returns Telegram diagnostics: telegramConfigured, tokenPresent, chatIdPresent,
 * lastTelegramSuccessAt, lastTelegramFailureAt, lastTelegramError.
 * Query params:
 *   dryRun=true|false (default true)
 *   maxApplications=number (1–50, default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
    const { searchParams } = new URL(request.url);
    const dryRunParam = searchParams.get("dryRun");
    const maxParam = searchParams.get("maxApplications");

    let dryRun = true;
    if (dryRunParam === "false") dryRun = false;

    let maxApplications = 10;
    if (maxParam) {
      const n = Number.parseInt(maxParam, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 50) {
        maxApplications = n;
      }
    }

    const [result, telegram, workerHealth] = await Promise.all([
      runAutoApply({ dryRun, maxApplications, verbose: true }),
      getTelegramDiagnostics(),
      getWorkerHealth(user)
    ]);

    return NextResponse.json({
      ok: true,
      dryRun,
      maxApplications,
      worker: {
        workerRunning: workerHealth.workerRunning,
        lastHeartbeatAt: workerHealth.lastHeartbeatAt?.toISOString() ?? null,
        lastRunStartedAt: workerHealth.lastRunStartedAt?.toISOString() ?? null,
        lastRunCompletedAt: workerHealth.lastRunCompletedAt?.toISOString() ?? null,
        lockActive: workerHealth.lockActive,
        staleLockDetected: workerHealth.staleLockDetected,
        queuedCount: workerHealth.queuedCount,
        attemptedToday: workerHealth.attemptedToday,
        appliedToday: workerHealth.appliedToday,
        failedToday: workerHealth.failedToday
      },
      queued: result.queued,
      queuedChecked: result.queued,
      attempted: result.applied + result.failed + result.needsReview,
      applied: result.applied,
      failed: result.failed,
      needs_review: result.needsReview,
      skipped: result.skipped,
      skipped_rules: result.skippedRules,
      skipped_unsupported: result.skippedUnsupported,
      supported_providers: [...SUPPORTED_PROVIDERS],
      unsupported_url_count: result.skippedUnsupported,
      telegram: {
        telegramConfigured: telegram.telegramConfigured,
        tokenPresent: telegram.tokenPresent,
        chatIdPresent: telegram.chatIdPresent,
        lastTelegramSuccessAt: telegram.lastTelegramSuccessAt?.toISOString() ?? null,
        lastTelegramFailureAt: telegram.lastTelegramFailureAt?.toISOString() ?? null,
        lastTelegramError: telegram.lastTelegramError
      },
      raw: result
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[JobRadar] Debug auto-apply error:", message);
    return NextResponse.json(
      { ok: false, error: "Debug auto-apply failed", detail: message },
      { status: 500 }
    );
  }
}

