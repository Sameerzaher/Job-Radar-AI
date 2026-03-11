/**
 * Greenhouse job board scraper. Fetches from the public Greenhouse boards API,
 * normalizes fields to the Job model shape, and returns payloads for ingestion.
 */

import type { IngestJobPayload } from "@/types/job";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";

const API_BASE = "https://boards-api.greenhouse.io/v1/boards";

type GreenhouseJob = {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  content?: string;
};

export interface GreenhouseScraperOptions {
  /** Board token, e.g. "notion", "vercel" */
  boardToken: string;
  /** Company name for the Job model */
  companyName: string;
  /** Optional API base (default: boards-api.greenhouse.io) */
  apiBaseUrl?: string;
}

/**
 * Fetch jobs from a public Greenhouse board.
 * GET https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs?content=true
 */
export async function fetchGreenhouseJobs(
  options: GreenhouseScraperOptions
): Promise<IngestJobPayload[]> {
  const { boardToken, companyName, apiBaseUrl = API_BASE } = options;
  const url = `${apiBaseUrl}/${boardToken}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error("[JobRadar] Greenhouse fetch failed", res.status, url, body);
    return [];
  }
  const json = (await res.json()) as { jobs?: GreenhouseJob[] };
  const rawJobs = json.jobs ?? [];
  const count = rawJobs.length;
  console.log("Fetched jobs:", count);

  const boardBaseUrl = `https://boards.greenhouse.io/${boardToken}`;
  const now = new Date();
  const payloads: IngestJobPayload[] = rawJobs.map((job) => {
    const rawUrl = job.absolute_url ?? "";
    const url = normalizeToAbsoluteUrl(rawUrl, boardBaseUrl) ?? rawUrl;
    return normalizeIngestPayload({
      source: "Greenhouse",
      externalId: String(job.id),
      title: job.title,
      company: companyName,
      location: job.location?.name ?? "Unknown",
      url,
      description: job.content ?? "",
      workModeText: job.location?.name,
      skills: [],
      postedAt: job.updated_at ?? null,
      foundAt: now
    });
  });

  return payloads;
}
