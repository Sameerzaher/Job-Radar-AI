import { chromium, type Browser, type Page } from "playwright";
import type { IngestJobPayload } from "@/types/job";
import type { JobWorkMode } from "@/models/Job";
import { scraperLogger } from "./scraperLogger";
import { stringHash, externalIdFromUrl, parsePostedDate } from "./utils";
import type { ScrapedJobRaw } from "./types";

const DEFAULT_CAREERS_URL =
  process.env.SCRAPER_CAREERS_URL ?? "http://localhost:3000/careers-sample.html";

const SOURCE_LABEL = "playwright-careers";

/**
 * Infer work mode from location text.
 */
function inferWorkMode(location: string): JobWorkMode | undefined {
  const lower = location.toLowerCase();
  if (/remote|anywhere|distributed/i.test(lower)) return "Remote";
  if (/hybrid/i.test(lower)) return "Hybrid";
  if (/on-?site|office|onsite/i.test(lower)) return "Onsite";
  return undefined;
}

/**
 * Normalize a scraped job to IngestJobPayload (Job model shape).
 * Generates externalId and hash for deduplication.
 */
function normalizeToPayload(raw: ScrapedJobRaw, baseUrl: string, foundAt: Date): IngestJobPayload {
  const jobUrl = raw.jobUrl.startsWith("http") ? raw.jobUrl : new URL(raw.jobUrl, baseUrl).href;
  const externalId = externalIdFromUrl(jobUrl);
  const hashInput = `${SOURCE_LABEL}:${externalId}:${raw.title}:${raw.company}`;
  const hash = stringHash(hashInput);

  scraperLogger.normalizedJob(raw.title, externalId, hash);

  return {
    source: SOURCE_LABEL,
    externalId,
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location.trim(),
    workMode: inferWorkMode(raw.location),
    url: jobUrl,
    description: raw.description.trim() || undefined,
    skillsExtracted: [],
    postedAt: parsePostedDate(raw.postedDate),
    foundAt,
    hash,
    status: "new"
  };
}

/**
 * Extract job cards from the careers page.
 * Selectors match public/careers-sample.html.
 */
async function extractJobCards(page: Page, baseUrl: string): Promise<ScrapedJobRaw[]> {
  const cards = await page.locator(".job-card").all();
  scraperLogger.foundCards(cards.length);

  const jobs: ScrapedJobRaw[] = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const title = (await card.locator(".job-title").first().textContent())?.trim() ?? "";
    scraperLogger.extractingJob(i + 1, cards.length, title);

    const company = (await card.locator(".job-company").first().textContent())?.trim() ?? "";
    const location = (await card.locator(".job-location").first().textContent())?.trim() ?? "";
    const link = card.locator("a.job-url").first();
    const href = (await link.getAttribute("href")) ?? "";
    const jobUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    const description = (await card.locator(".job-description").first().innerText())?.trim() ?? "";
    const dateEl = card.locator(".job-date").first();
    const postedDate = await dateEl.textContent();

    jobs.push({
      title,
      company,
      location,
      jobUrl,
      description,
      postedDate: postedDate?.trim() ?? null
    });
  }
  return jobs;
}

export interface PlaywrightScraperConfig {
  /** URL of the careers page to scrape */
  careersUrl?: string;
  /** Headless mode (default true) */
  headless?: boolean;
}

/**
 * Scrape jobs from the configured careers page using Playwright.
 * Returns normalized IngestJobPayload[] ready for ingestion (duplicate check and insert+match happen in ingestion layer).
 */
export async function scrapeCareersPage(config: PlaywrightScraperConfig = {}): Promise<IngestJobPayload[]> {
  const careersUrl = config.careersUrl ?? DEFAULT_CAREERS_URL;
  const headless = config.headless ?? true;
  let browser: Browser | null = null;

  try {
    scraperLogger.launchingBrowser();
    browser = await chromium.launch({ headless });

    const context = await browser.newContext({ userAgent: "JobRadar-Scraper/1.0" });
    const page = await context.newPage();

    scraperLogger.navigating(careersUrl);
    await page.goto(careersUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    scraperLogger.pageLoaded(page.url());

    const baseUrl = new URL(careersUrl).origin;
    const rawJobs = await extractJobCards(page, baseUrl);

    const foundAt = new Date();
    const payloads = rawJobs.map((raw) => normalizeToPayload(raw, baseUrl, foundAt));
    scraperLogger.normalizedCount(payloads.length);

    return payloads;
  } finally {
    if (browser) {
      await browser.close();
      scraperLogger.browserClosed();
    }
  }
}
