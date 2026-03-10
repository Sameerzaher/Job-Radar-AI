import type { IngestJobPayload } from "@/types/job";

/**
 * Pluggable job source for sync. Implement this for static data,
 * Playwright scrapers, or API-based fetchers.
 */
export interface IJobSource {
  /** Display name for logging */
  readonly label: string;
  /** Fetch jobs to ingest. Called each sync run. */
  fetchJobs(): Promise<IngestJobPayload[]>;
}
