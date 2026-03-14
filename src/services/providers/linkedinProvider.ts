/**
 * LinkedIn provider adapter (discovery-only).
 * Uses Playwright to scrape LinkedIn job search pages and normalizes to IngestJobPayload.
 * Searches are built from the Default Candidate profile (targetRoles, preferredLocations, workModes, skills).
 * LinkedIn jobs are review-only; they never go through auto-apply.
 */

import type { IngestJobPayload } from "@/types/job";
import type { BoardConfig, IJobProvider, RawJob } from "./types";
import { isValidJobUrl, normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";
import { buildLinkedInSearchQueriesFromUser } from "./linkedinQueryBuilder";
import { getOrCreateDefaultUser } from "@/services/userService";

type LinkedInRawJob = {
  title: string;
  company: string;
  location: string;
  url: string;
  isSponsored: boolean;
};

const MAX_SCROLL_ITERATIONS = 3;
const JOB_CARD_SELECTORS =
  "div.base-card.job-search-card, div.job-search-card, li.jobs-search-results__list-item, div.job-card-container, div.base-card.base-card--link";
const TITLE_SELECTORS =
  "h3.base-search-card__title, a.job-card-list__title, a.job-card-container__link, [data-control-name='job_card_title']";
const COMPANY_SELECTORS =
  "h4.base-search-card__subtitle, .job-card-container__company-name, .job-card-list__subtitle";
const LOCATION_SELECTORS =
  "span.job-search-card__location, .job-card-container__metadata-item, .job-card-container__metadata-item--bullet";

function randomDelay(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

/** Fetches job cards from a single LinkedIn search URL. Used internally. */
async function fetchJobsFromOneSearchUrl(
  searchUrl: string,
  _boardId: string
): Promise<LinkedInRawJob[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const collected: LinkedInRawJob[] = [];

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(randomDelay(3000, 5000));

    const listOrCard = await page
      .waitForSelector(".jobs-search-results-list, .jobs-search-results, div.base-card, li.jobs-search-results__list-item", {
        timeout: 15000
      })
      .catch(() => null);
    if (!listOrCard) {
      const hasSignIn = await page.locator("text=/sign in|log in|join linkedin/i").first().isVisible().catch(() => false);
      if (hasSignIn) {
        console.log("[JobRadar] LinkedIn: sign-in or join wall detected; 0 jobs for this query.");
      }
      return [];
    }

    for (let i = 0; i < MAX_SCROLL_ITERATIONS; i++) {
      await page.evaluate(() => {
        const list = document.querySelector(".jobs-search-results-list") || document.querySelector(".scaffold-layout__list-container");
        const el = list || document.scrollingElement;
        if (el) {
          (el as HTMLElement).scrollTop += (el as HTMLElement).clientHeight * 1.2;
        }
        window.scrollBy(0, 400);
      });
      await page.waitForTimeout(randomDelay(2000, 4000));

      const pageJobs = await page.evaluate(
        (opts: { cardSel: string; titleSel: string; companySel: string; locationSel: string }) => {
          const { cardSel, titleSel, companySel, locationSel } = opts;
          const cards = Array.from(document.querySelectorAll(cardSel));
          const items: { title: string; company: string; location: string; url: string; isSponsored: boolean }[] = [];
          for (const node of cards) {
            const linkEl = node.querySelector<HTMLAnchorElement>("a[href*='/jobs/view/']");
            const url = linkEl?.href?.trim() ?? "";
            if (!url) continue;

            const titleEl = node.querySelector(titleSel) || linkEl;
            const companyEl = node.querySelector(companySel);
            const locationEl = node.querySelector(locationSel);
            const title = (titleEl?.textContent ?? "").trim();
            const company = (companyEl?.textContent ?? "").trim();
            const location = (locationEl?.textContent ?? "").trim();
            if (!title) continue;

            const text = node.textContent || "";
            const isSponsored = /promoted|sponsored/i.test(text);

            items.push({
              title,
              company: company || "Unknown",
              location: location || "",
              url,
              isSponsored
            });
          }
          return items;
        },
        {
          cardSel: JOB_CARD_SELECTORS,
          titleSel: TITLE_SELECTORS,
          companySel: COMPANY_SELECTORS,
          locationSel: LOCATION_SELECTORS
        }
      );

      for (const j of pageJobs) {
        if (!collected.some((c) => c.url === j.url)) {
          collected.push(j);
        }
      }
    }
  } catch (err) {
    console.error("[JobRadar] LinkedIn fetch failed for URL:", searchUrl, err);
  } finally {
    await browser.close();
  }

  return collected;
}

export const linkedinProvider: IJobProvider = {
  getSourceName: () => "LinkedIn",

  async fetchJobs(board: BoardConfig): Promise<RawJob[]> {
    const explicitSearchUrl = (board.searchUrl || board.boardUrl || "").trim();
    const useProfile = !explicitSearchUrl || board.boardKey === "profile";

    if (useProfile) {
      // Build searches from Default Candidate profile
      const user = await getOrCreateDefaultUser();
      const queries = buildLinkedInSearchQueriesFromUser(user);

      if (queries.length === 0) {
        console.warn(
          "[JobRadar] LinkedIn: candidate profile has no targetRoles; no search queries generated. " +
            "Update Profile (targetRoles, preferredLocations, workModes) to enable LinkedIn discovery."
        );
        return [];
      }

      console.log("[JobRadar] LinkedIn using candidate:", user.name ?? "Default Candidate");
      console.log("[JobRadar] LinkedIn targetRoles:", (user.targetRoles ?? []).join(", ") || "—");
      for (const q of queries) {
        console.log("[JobRadar] LinkedIn query:", `${q.role} | ${q.location}`, "→", q.searchUrl);
      }

      const allByUrl = new Map<string, LinkedInRawJob>();
      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        const jobs = await fetchJobsFromOneSearchUrl(q.searchUrl, board.id);
        for (const j of jobs) {
          if (!allByUrl.has(j.url)) allByUrl.set(j.url, j);
        }
        if (i < queries.length - 1) {
          await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
        }
      }

      const collected = Array.from(allByUrl.values());
      console.log("[JobRadar] LinkedIn jobs fetched:", collected.length, "for board", board.id, "(deduplicated across", queries.length, "queries)");
      return collected as unknown as RawJob[];
    }

    // Legacy: single explicit URL from board config
    console.log("[JobRadar] LinkedIn fetch start (single URL):", explicitSearchUrl);
    const collected = await fetchJobsFromOneSearchUrl(explicitSearchUrl, board.id);
    console.log("[JobRadar] LinkedIn jobs fetched:", collected.length, "for board", board.id);
    return collected as unknown as RawJob[];
  },

  normalizeJob(raw: RawJob, board: BoardConfig): IngestJobPayload | null {
    const job = raw as LinkedInRawJob;
    const title = job.title?.trim();
    const company = job.company?.trim();
    const url = job.url?.trim();
    if (!title || !company || !url) return null;
    if (job.isSponsored) {
      // Skip sponsored / promoted jobs when possible
      return null;
    }

    // Extract numeric id from LinkedIn URL if present
    let externalId = url;
    const idMatch = url.match(/\/jobs\/view\/(\d+)/) || url.match(/currentJobId=(\d+)/);
    if (idMatch && idMatch[1]) {
      externalId = idMatch[1];
    }

    const normalizedUrl = normalizeToAbsoluteUrl(url, "https://www.linkedin.com") ?? url;
    const now = new Date();

    const payload = normalizeIngestPayload({
      source: "LinkedIn",
      externalId,
      title,
      company,
      location: job.location || "Unknown",
      url: normalizedUrl,
      description: "",
      workModeText: job.location,
      skills: [],
      postedAt: now,
      foundAt: now
    });

    (payload as IngestJobPayload & { country?: string }).country = board.country;
    (payload as IngestJobPayload & { remoteSupport?: boolean }).remoteSupport = board.remoteSupport;

    return payload;
  },

  validateJob(payload: IngestJobPayload): boolean {
    if (!payload.title?.trim() || !payload.company?.trim() || !payload.source?.trim()) return false;
    if (!payload.externalId?.trim() && !payload.hash) return false;
    if (!isValidJobUrl(payload.url)) return false;
    return true;
  }
};

