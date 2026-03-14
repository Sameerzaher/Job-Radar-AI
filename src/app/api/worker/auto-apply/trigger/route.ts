import { NextResponse } from "next/server";
import { runAutoApplyWorker } from "@/services/autoApply/worker";

/**
 * POST /api/worker/auto-apply/trigger
 * Run one auto-apply cycle (same logic as the scheduled worker).
 * Respects AUTO_APPLY_ENABLED and DRY_RUN_DEFAULT.
 */
export async function POST() {
  try {
    const { ran, result, skippedReason } = await runAutoApplyWorker();
    return NextResponse.json({
      ok: true,
      ran,
      skippedReason: skippedReason ?? null,
      result: result
        ? {
            queued: result.queued,
            applied: result.applied,
            failed: result.failed,
            needsReview: result.needsReview,
            skipped: result.skipped,
            skippedRules: result.skippedRules,
            skippedUnsupported: result.skippedUnsupported
          }
        : null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[JobRadar] Manual worker trigger error:", message);
    return NextResponse.json(
      { ok: false, error: "Worker run failed", detail: message },
      { status: 500 }
    );
  }
}
