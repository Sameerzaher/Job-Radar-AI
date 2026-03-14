import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/services/userService";
import { overrideRulesAndQueue } from "@/services/jobService";

/**
 * POST /api/apply/override-rules
 * Manually override rules and send a skipped_rules match back to the auto-apply queue.
 * Body: { matchId: string }
 * Safety: still requires supported URL and provider; does not bypass URL/provider checks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const matchId = typeof body.matchId === "string" ? body.matchId.trim() : null;
    if (!matchId) {
      return NextResponse.json({ ok: false, error: "matchId required" }, { status: 400 });
    }

    const user = await getOrCreateDefaultUser();
    const result = await overrideRulesAndQueue(matchId, user);
    if (!result.ok) {
      const status = result.error?.includes("not found") ? 404 : result.error?.includes("cannot be auto-applied") ? 400 : 400;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
