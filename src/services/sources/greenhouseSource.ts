import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { fetchGreenhouseJobs as fetchFromScraper } from "@/services/scrapers/greenhouseScraper";
import type { GreenhouseScraperOptions } from "@/services/scrapers/greenhouseScraper";

export interface GreenhouseSourceConfig {
  /** Greenhouse board token, e.g. yourcompany */
  boardToken: string;
  /** Optional override for API URL */
  apiBaseUrl?: string;
  /** Company name to display in Job entity */
  companyName: string;
}

/**
 * Creates a job source that uses the shared Greenhouse scraper.
 * Integrated with the ingestion pipeline (syncService / dashboard Sync now).
 */
export function createGreenhouseSource(config: GreenhouseSourceConfig): IJobSource {
  const options: GreenhouseScraperOptions = {
    boardToken: config.boardToken,
    companyName: config.companyName,
    apiBaseUrl: config.apiBaseUrl
  };
  return {
    label: `greenhouse:${config.boardToken}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      return fetchFromScraper(options);
    }
  };
}

