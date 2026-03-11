const prefix = "[JobRadar]";

function timestamp(): string {
  return new Date().toISOString();
}

export const syncLogger = {
  syncStarted(sourceLabel: string): void {
    console.log(`${timestamp()} ${prefix} Sync started (source: ${sourceLabel})`);
  },

  jobsFetched(count: number): void {
    console.log(`${timestamp()} ${prefix} Jobs fetched: ${count}`);
  },

  duplicatesSkipped(count: number): void {
    console.log(`${timestamp()} ${prefix} Duplicates skipped: ${count}`);
  },

  skippedInvalidUrl(count: number): void {
    console.log(`${timestamp()} ${prefix} Skipped (invalid URL): ${count}`);
  },

  jobsInserted(count: number): void {
    console.log(`${timestamp()} ${prefix} Jobs inserted: ${count}`);
  },

  matchesCreated(count: number): void {
    console.log(`${timestamp()} ${prefix} Matches created: ${count}`);
  },

  syncFinished(durationMs: number, errors: number): void {
    if (errors > 0) {
      console.warn(`${timestamp()} ${prefix} Sync finished in ${durationMs}ms with ${errors} error(s)`);
    } else {
      console.log(`${timestamp()} ${prefix} Sync finished in ${durationMs}ms`);
    }
  },

  syncError(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`${timestamp()} ${prefix} Sync error: ${message}`, detail);
  },

  /** Log real job URLs captured (saved to DB). */
  realUrlsCaptured(urls: string[]): void {
    const n = urls.length;
    console.log(`${timestamp()} ${prefix} Real URLs captured: ${n}`);
    urls.slice(0, 20).forEach((u, i) => console.log(`${timestamp()} ${prefix}   ${i + 1}. ${u}`));
    if (n > 20) console.log(`${timestamp()} ${prefix}   ... and ${n - 20} more`);
  }
};
