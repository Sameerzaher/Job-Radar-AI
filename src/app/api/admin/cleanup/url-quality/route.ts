import { NextRequest, NextResponse } from "next/server";
import { runUrlQualityCleanup } from "@/services/cleanup/urlQualityCleanup";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function isAdminAuthorized(request: NextRequest): boolean {
  if (!ADMIN_API_KEY) return true;
  const key =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === ADMIN_API_KEY;
}

/**
 * POST /api/admin/cleanup/url-quality
 * Runs URL quality cleanup: classify existing jobs, set urlClassification + autoApplySupported,
 * and move ineligible matches out of queued/approved. Returns summary report.
 *
 * Body (optional): { dryRun?: boolean, archiveInvalidUrlJobs?: boolean }
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dryRun = false;
  let archiveInvalidUrlJobs = false;
  try {
    const body = await request.json().catch(() => ({}));
    dryRun = Boolean(body.dryRun);
    archiveInvalidUrlJobs = Boolean(body.archiveInvalidUrlJobs);
  } catch {
    // leave defaults
  }

  try {
    const report = await runUrlQualityCleanup({
      dryRun,
      archiveInvalidUrlJobs
    });
    return NextResponse.json({
      ok: true,
      report: {
        totalJobsChecked: report.totalJobsChecked,
        jobsUpdated: report.jobsUpdated,
        supported_apply_url: report.supported_apply_url,
        generic_careers_page: report.generic_careers_page,
        unsupported_custom_careers_page: report.unsupported_custom_careers_page,
        invalid_url: report.invalid_url,
        autoApplySupportedTrue: report.autoApplySupportedTrue,
        autoApplySupportedFalse: report.autoApplySupportedFalse,
        matchesMovedOutOfQueue: report.matchesMovedOutOfQueue,
        matchesSetToSkippedUnsupported: report.matchesSetToSkippedUnsupported,
        jobsArchived: report.jobsArchived,
        dryRun: report.dryRun
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "URL quality cleanup failed", detail: message },
      { status: 500 }
    );
  }
}
