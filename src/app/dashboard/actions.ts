"use server";

import { runBatchSync } from "@/services/discovery/batchSyncEngine";

export type SyncActionResult =
  | { ok: true; result: { jobsFetched: number; jobsInserted: number; duplicatesSkipped: number; matchesCreated: number } }
  | { ok: false; error: string };

/**
 * Run batch sync from all enabled boards (discovery engine). Call from dashboard.
 */
export async function triggerSync(): Promise<SyncActionResult> {
  try {
    const result = await runBatchSync();
    return {
      ok: true,
      result: {
        jobsFetched: result.totalFetched,
        jobsInserted: result.totalSaved,
        duplicatesSkipped: result.totalDuplicates,
        matchesCreated: result.totalSaved
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
