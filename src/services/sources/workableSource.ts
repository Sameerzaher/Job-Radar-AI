import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { fetchWorkableJobs } from "@/services/scrapers/workableScraper";
import type { WorkableScraperOptions } from "@/services/scrapers/workableScraper";

export interface WorkableSourceConfig {
  /** Workable account slug (e.g. from apply.workable.com/{account}) */
  account: string;
  /** Optional API base URL override */
  apiBaseUrl?: string;
  /** Company name to display in Job entity */
  companyName: string;
}

/** Creates a job source that uses the shared Workable scraper. */
export function createWorkableSource(config: WorkableSourceConfig): IJobSource {
  const options: WorkableScraperOptions = {
    account: config.account,
    companyName: config.companyName,
    apiBaseUrl: config.apiBaseUrl
  };
  return {
    label: `workable:${config.account}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      return fetchWorkableJobs(options);
    }
  };
}

