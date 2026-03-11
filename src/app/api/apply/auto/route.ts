import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/services/userService";
import { runAutoApply } from "@/services/autoApply/applyAgent";

/**
 * POST /api/apply/auto
 * Run auto-apply for eligible high-score jobs (Greenhouse, Lever, Workable).
 * Body: { dryRun?: boolean, maxApplications?: number }
 * Safety: dryRun, maxApplications, supported sources only, verbose logs.
 */
export async function POST(request: NextRequest) {
  try {
    await getOrCreateDefaultUser();
    let dryRun = false;
    let maxApplications = 10;
    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
      if (typeof body.maxApplications === "number" && body.maxApplications >= 1 && body.maxApplications <= 50) {
        maxApplications = body.maxApplications;
      }
    } catch {
      // use defaults
    }

    const result = await runAutoApply({
      dryRun,
      maxApplications,
      verbose: true
    });

    return NextResponse.json({
      ok: true,
      dryRun,
      maxApplications,
      ...result
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[JobRadar] Auto-apply error:", message);
    return NextResponse.json(
      { ok: false, error: "Auto-apply failed", detail: message },
      { status: 500 }
    );
  }
}
