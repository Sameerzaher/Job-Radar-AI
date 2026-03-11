import { NextRequest, NextResponse } from "next/server";
import { runSyncAll } from "@/services/syncService";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function isAdminAuthorized(request: NextRequest): boolean {
  if (!ADMIN_API_KEY) return true;
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === ADMIN_API_KEY;
}

/**
 * POST /api/admin/sync
 * Fetches jobs from all registered real sources (Greenhouse, Lever, etc.),
 * saves only jobs with valid external URLs, and creates matches.
 * Demo/sample source is not used.
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSyncAll();
    return NextResponse.json({
      ok: true,
      startedAt: result.startedAt.toISOString(),
      finishedAt: result.finishedAt.toISOString(),
      jobsFetched: result.jobsFetched,
      jobsInserted: result.jobsInserted,
      duplicatesSkipped: result.duplicatesSkipped,
      skippedInvalidUrl: result.skippedInvalidUrl,
      matchesCreated: result.matchesCreated,
      errors: result.errors,
      sourceLabel: result.sourceLabel
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Sync failed", detail: message }, { status: 500 });
  }
}
