import type { IJobSource } from "./types";
import { scrapeCareersPage, type PlaywrightScraperConfig } from "@/services/scrapers/playwrightScraper";

/**
 * Job source that fetches jobs by scraping the configured careers page with Playwright.
 * Integrates with the cron/API sync pipeline; duplicate check and match creation happen in ingestion.
 */
export function createPlaywrightJobSource(config: PlaywrightScraperConfig = {}): IJobSource {
  return {
    label: "playwright-careers",
    async fetchJobs() {
      return scrapeCareersPage(config);
    }
  };
}

/** Default instance: scrapes SCRAPER_CAREERS_URL or localhost careers-sample.html */
export const playwrightJobSource = createPlaywrightJobSource();
