import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/services/syncService";
import { playwrightJobSource } from "@/services/sources/playwrightJobSource";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function isAdminAuthorized(request: NextRequest): boolean {
  if (!ADMIN_API_KEY) return true;
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === ADMIN_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync(playwrightJobSource);
    return NextResponse.json({
      ok: true,
      startedAt: result.startedAt.toISOString(),
      finishedAt: result.finishedAt.toISOString(),
      jobsFetched: result.jobsFetched,
      jobsInserted: result.jobsInserted,
      duplicatesSkipped: result.duplicatesSkipped,
      matchesCreated: result.matchesCreated,
      errors: result.errors,
      sourceLabel: result.sourceLabel
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Sync failed", detail: message }, { status: 500 });
  }
}
