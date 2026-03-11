import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { fetchLeverJobs } from "@/services/scrapers/leverScraper";
import type { LeverScraperOptions } from "@/services/scrapers/leverScraper";

export interface LeverSourceConfig {
  /** Lever company slug, e.g. stripe, vercel */
  company: string;
  /** Display company name for the Job model */
  companyName?: string;
}

/**
 * Creates a job source that uses the shared Lever scraper.
 * Integrated with the ingestion pipeline (syncService / dashboard Sync now).
 */
export function createLeverSource(config: LeverSourceConfig): IJobSource {
  const companyName = config.companyName ?? config.company;
  const options: LeverScraperOptions = { company: config.company, companyName };
  return {
    label: `lever:${config.company}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      return fetchLeverJobs(options);
    }
  };
}

