/**
 * Run the Telegram digest once (new high-match jobs + status changes).
 * Use for cron: e.g. 0 9 * * * (daily at 9:00) or call GET /api/cron/digest.
 */
import "dotenv/config";
import { runDigest } from "@/services/digestService";

async function main(): Promise<void> {
  const result = await runDigest();
  if (result.sent) {
    console.log("[JobRadar] Digest sent successfully.");
  } else if (result.error) {
    console.error("[JobRadar] Digest failed:", result.error);
    process.exit(1);
  } else {
    console.log("[JobRadar] Digest skipped (e.g. Telegram not configured).");
  }
}

main();
