"use server";

import { runSyncAll, type SyncResult } from "@/services/syncService";

export type SyncActionResult =
  | { ok: true; result: SyncResult }
  | { ok: false; error: string };

/**
 * Run full sync from primary sources (Greenhouse + Lever). Call from dashboard;
 * no API key required since this runs on the server.
 */
export async function triggerSync(): Promise<SyncActionResult> {
  try {
    const result = await runSyncAll();
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
