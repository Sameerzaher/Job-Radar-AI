const prefix = "[JobRadar:Scraper]";

function timestamp(): string {
  return new Date().toISOString();
}

export const scraperLogger = {
  launchingBrowser(): void {
    console.log(`${timestamp()} ${prefix} Launching browser`);
  },

  navigating(url: string): void {
    console.log(`${timestamp()} ${prefix} Navigating to ${url}`);
  },

  pageLoaded(url: string): void {
    console.log(`${timestamp()} ${prefix} Page loaded: ${url}`);
  },

  foundCards(count: number): void {
    console.log(`${timestamp()} ${prefix} Found ${count} job card(s)`);
  },

  extractingJob(index: number, total: number, title: string): void {
    console.log(`${timestamp()} ${prefix} Extracting job ${index}/${total}: ${title}`);
  },

  normalizedJob(title: string, externalId: string, hash: string): void {
    console.log(`${timestamp()} ${prefix} Normalized: "${title}" → externalId=${externalId}, hash=${hash}`);
  },

  normalizedCount(count: number): void {
    console.log(`${timestamp()} ${prefix} Normalized ${count} job(s) to ingest payloads`);
  },

  duplicateSkipped(externalId: string, reason: string): void {
    console.log(`${timestamp()} ${prefix} Duplicate skipped (${reason}): ${externalId}`);
  },

  browserClosed(): void {
    console.log(`${timestamp()} ${prefix} Browser closed`);
  },

  error(step: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`${timestamp()} ${prefix} Error at ${step}:`, detail);
  }
};
