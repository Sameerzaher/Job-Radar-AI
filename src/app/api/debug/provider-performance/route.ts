import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/services/userService";
import {
  getProviderPerformance,
  getFailureReasonsByProvider
} from "@/services/autoApply/providerPerformance";

/**
 * GET /api/debug/provider-performance
 * Returns provider stats for today, success rates, and failure reasons grouped by provider.
 */
export async function GET() {
  try {
    const user = await getOrCreateDefaultUser();
    const [providerStats, failureReasons] = await Promise.all([
      getProviderPerformance(user),
      getFailureReasonsByProvider(user)
    ]);

    const byProvider = failureReasons.reduce<Record<string, Array<{ reason: string; count: number }>>>(
      (acc, { provider, reason, count }) => {
        if (!acc[provider]) acc[provider] = [];
        acc[provider].push({ reason, count });
        return acc;
      },
      {}
    );

    return NextResponse.json({
      ok: true,
      providerStats: providerStats.map((s) => ({
        provider: s.provider,
        attempted: s.attempted,
        applied: s.applied,
        needs_review: s.needs_review,
        skipped_unsupported: s.skipped_unsupported,
        failed: s.failed,
        successRate: s.successRate
      })),
      failureReasonsByProvider: byProvider
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[JobRadar] provider-performance error:", message);
    return NextResponse.json(
      { ok: false, error: "Provider performance failed", detail: message },
      { status: 500 }
    );
  }
}
