/**
 * URL quality cleanup: classify existing jobs by URL, set urlClassification + autoApplySupported,
 * and move ineligible matches out of queued/approved (set to skipped_unsupported).
 *
 * Usage:
 *   npm run cleanup:url-quality              # run for real
 *   npx tsx scripts/cleanup-url-quality.ts --dry-run       # no writes, report only
 *   npx tsx scripts/cleanup-url-quality.ts --archive-invalid # archive invalid_url jobs
 */
import "dotenv/config";

import { runUrlQualityCleanup } from "@/services/cleanup/urlQualityCleanup";

const dryRun = process.argv.includes("--dry-run");
const archiveInvalid = process.argv.includes("--archive-invalid");

async function main() {
  console.log("[JobRadar] URL quality cleanup | dryRun=", dryRun, "archiveInvalid=", archiveInvalid);
  const report = await runUrlQualityCleanup({
    dryRun,
    archiveInvalidUrlJobs: archiveInvalid
  });
  console.log("\n--- Summary report ---");
  console.log("Total jobs checked:", report.totalJobsChecked);
  console.log("Jobs updated:", report.jobsUpdated);
  console.log("Classification counts:");
  console.log("  supported_apply_url:", report.supported_apply_url);
  console.log("  generic_careers_page:", report.generic_careers_page);
  console.log("  unsupported_custom_careers_page:", report.unsupported_custom_careers_page);
  console.log("  invalid_url:", report.invalid_url);
  console.log("Total jobs marked autoApplySupported=true:", report.autoApplySupportedTrue);
  console.log("Total jobs marked autoApplySupported=false:", report.autoApplySupportedFalse);
  console.log("Matches moved out of queued/approved:", report.matchesMovedOutOfQueue);
  console.log("Matches set to skipped_unsupported:", report.matchesSetToSkippedUnsupported);
  console.log("Jobs archived (invalid_url):", report.jobsArchived);
  console.log("Dry run:", report.dryRun);
  process.exit(0);
}

main().catch((err) => {
  console.error("[JobRadar] Cleanup failed:", err);
  process.exit(1);
});
