import { NextRequest, NextResponse } from "next/server";
import { runBatchSync } from "@/services/discovery/batchSyncEngine";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function isAdminAuthorized(request: NextRequest): boolean {
  if (!ADMIN_API_KEY) return true;
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === ADMIN_API_KEY;
}

/**
 * POST /api/admin/sync
 * Runs batch sync across all enabled boards (discovery engine). Returns structured summary.
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBatchSync();
    return NextResponse.json({
      ok: true,
      startedAt: result.startedAt.toISOString(),
      completedAt: result.completedAt.toISOString(),
      boardsRun: result.boardsRun,
      boardsFailed: result.boardsFailed,
      jobsFetched: result.totalFetched,
      jobsInserted: result.totalSaved,
      duplicatesSkipped: result.totalDuplicates,
      totalInvalid: result.totalInvalid,
      totalErrors: result.totalErrors,
      byBoard: result.byBoard
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Sync failed", detail: message }, { status: 500 });
  }
}
