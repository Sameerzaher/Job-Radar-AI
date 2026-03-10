import "dotenv/config";
import cron from "node-cron";
import { runSync } from "@/services/syncService";
import { playwrightJobSource } from "@/services/sources/playwrightJobSource";

const CRON_SCHEDULE = "0 */6 * * *"; // Every 6 hours (at 0 min past hour 0, 6, 12, 18)

async function runSyncJob(): Promise<void> {
  try {
    await runSync(playwrightJobSource);
  } catch (err) {
    console.error("[JobRadar] Cron sync failed:", err);
  }
}

function main(): void {
  console.log(`[JobRadar] Sync cron scheduled: ${CRON_SCHEDULE} (every 6 hours)`);
  cron.schedule(CRON_SCHEDULE, runSyncJob);

  // Run once on startup
  runSyncJob();
}

main();
