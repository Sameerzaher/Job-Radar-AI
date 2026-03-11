/**
 * Database cleanup: remove jobs with invalid or fake external URLs,
 * and remove related Match records for those jobs.
 *
 * Jobs are REMOVED when:
 *   - url is missing
 *   - url is empty
 *   - url is "#"
 *   - url contains example.com (or example.org, example.net)
 *   - url contains localhost or 127.0.0.1
 *   - url is any other fake/demo/placeholder (dummy.com, test.com, etc.)
 *
 * Jobs are KEPT when they have a valid http/https URL that is not a placeholder.
 *
 * Run: npm run cleanup:jobs
 * Or:  npx tsx scripts/cleanup-fake-jobs.ts
 */

import "dotenv/config";
import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { Match } from "@/models/Match";
import { getValidJobUrl } from "@/lib/urlValidation";

async function main() {
  await connectToDatabase();

  const jobs = await Job.find().lean();
  const total = jobs.length;

  let removedJobs = 0;
  let removedMatches = 0;

  for (const job of jobs) {
    const validUrl = getValidJobUrl(job);
    if (validUrl != null) continue;

    const jobId = (job as { _id: unknown })._id;
    const matchResult = await Match.deleteMany({ job: jobId });
    removedMatches += matchResult.deletedCount;
    await Job.deleteOne({ _id: jobId });
    removedJobs += 1;
  }

  const keptJobs = total - removedJobs;

  console.log("\n[JobRadar] Cleanup summary");
  console.log("─────────────────────────");
  console.log(`  Jobs removed:  ${removedJobs}`);
  console.log(`  Jobs kept:      ${keptJobs}`);
  console.log(`  Matches removed: ${removedMatches}`);
  console.log("─────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
