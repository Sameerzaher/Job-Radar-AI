/**
 * Workable job board scraper. Fetches from the public Workable API,
 * normalizes fields to the Job model shape, and returns payloads for ingestion.
 */

import type { IngestJobPayload } from "@/types/job";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";

const API_BASE = "https://apply.workable.com/api/v3/accounts";

type WorkableJob = {
  id: string;
  title: string;
  url?: string;
  application_url?: string;
  city?: string;
  state?: string;
  country?: string;
  region?: string;
  description?: string;
  updated_at?: string;
  created_at?: string;
  workplace?: string;
  employment_type?: string;
};

type WorkableResponse = {
  results?: WorkableJob[];
  nextPage?: string;
};

export interface WorkableScraperOptions {
  /** Workable account/subdomain slug (e.g. from apply.workable.com/{account}) */
  account: string;
  /** Display company name for the Job model */
  companyName: string;
  /** Optional API base */
  apiBaseUrl?: string;
}

function buildLocation(job: WorkableJob): string {
  const parts = [job.city, job.state, job.country, job.region].filter(Boolean);
  return parts.join(", ").trim() || "Unknown";
}

/**
 * Fetch jobs from a public Workable account.
 * GET https://apply.workable.com/api/v3/accounts/{account}/jobs?state=published
 */
export async function fetchWorkableJobs(
  options: WorkableScraperOptions
): Promise<IngestJobPayload[]> {
  const { account, companyName, apiBaseUrl = API_BASE } = options;
  const url = `${apiBaseUrl}/${account}/jobs?state=published`;
  console.log("[JobRadar] Workable fetching board:", account, url);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error("[JobRadar] Workable fetch failed", res.status, url, body);
    return [];
  }
  const json = (await res.json()) as WorkableResponse;
  const rawJobs = json.results ?? [];
  const count = rawJobs.length;
  console.log("[JobRadar] Workable fetched jobs:", count);

  const baseUrl = "https://apply.workable.com";
  const now = new Date();
  const payloads: IngestJobPayload[] = rawJobs.map((job) => {
    const rawUrl = job.url ?? job.application_url ?? "";
    const url = normalizeToAbsoluteUrl(rawUrl, baseUrl) ?? rawUrl;
    const location = buildLocation(job);
    const workModeText = job.workplace ?? job.employment_type ?? location;
    return normalizeIngestPayload({
      source: "Workable",
      externalId: job.id,
      title: job.title,
      company: companyName,
      location,
      url,
      description: job.description ?? "",
      workModeText,
      skills: [],
      postedAt: job.updated_at ?? job.created_at ?? null,
      foundAt: now
    });
  });

  return payloads;
}
