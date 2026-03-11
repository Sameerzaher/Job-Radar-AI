/**
 * Lever job board scraper. Fetches from the public Lever postings API,
 * normalizes fields to the Job model shape, and returns payloads for ingestion.
 */

import type { IngestJobPayload } from "@/types/job";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";

const API_BASE = "https://api.lever.co/v0/postings";

type LeverJob = {
  id: string;
  text: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
    department?: string;
  };
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  description?: string;
  descriptionPlain?: string;
};

export interface LeverScraperOptions {
  /** Company slug for the API, e.g. "stripe", "vercel" */
  company: string;
  /** Display company name for the Job model */
  companyName: string;
  /** Optional API base (default: api.lever.co/v0/postings) */
  apiBaseUrl?: string;
}

/**
 * Build description with optional team/department and commitment.
 */
function buildDescription(job: LeverJob): string {
  const parts: string[] = [];
  if (job.descriptionPlain) parts.push(job.descriptionPlain);
  if (job.description && !job.descriptionPlain) parts.push(job.description);
  const meta: string[] = [];
  if (job.categories?.team) meta.push(`Team: ${job.categories.team}`);
  if (job.categories?.department) meta.push(`Department: ${job.categories.department}`);
  if (job.categories?.commitment) meta.push(`Commitment: ${job.categories.commitment}`);
  if (meta.length) parts.push(meta.join(" · "));
  return parts.join("\n\n").trim() || "";
}

/**
 * Fetch jobs from a public Lever board.
 * GET https://api.lever.co/v0/postings/{company}?mode=json
 */
export async function fetchLeverJobs(options: LeverScraperOptions): Promise<IngestJobPayload[]> {
  const { company, companyName, apiBaseUrl = API_BASE } = options;
  const url = `${apiBaseUrl}/${company}?mode=json`;
  console.log("[JobRadar] Lever fetching board:", company, url);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error("[JobRadar] Lever fetch failed", res.status, url, body);
    return [];
  }
  const rawJobs = (await res.json()) as LeverJob[];
  const count = Array.isArray(rawJobs) ? rawJobs.length : 0;
  console.log("[JobRadar] Lever fetched jobs:", count);

  const baseUrl = "https://api.lever.co";
  const now = new Date();
  const payloads: IngestJobPayload[] = (Array.isArray(rawJobs) ? rawJobs : []).map((job) => {
    const rawUrl = job.hostedUrl ?? job.applyUrl ?? "";
    const url = normalizeToAbsoluteUrl(rawUrl, baseUrl) ?? rawUrl;
    return normalizeIngestPayload({
      source: "Lever",
      externalId: job.id,
      title: job.text,
      company: companyName,
      location: job.categories?.location ?? "Unknown",
      url,
      description: buildDescription(job),
      workModeText: job.categories?.location,
      skills: [],
      postedAt: job.createdAt != null ? new Date(job.createdAt) : null,
      foundAt: now
    });
  });

  return payloads;
}
