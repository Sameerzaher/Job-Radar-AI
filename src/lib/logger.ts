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
  }
};
