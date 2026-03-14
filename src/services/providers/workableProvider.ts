/**
 * Workable provider adapter.
 * Fetches from apply.workable.com API, normalizes to IngestJobPayload, validates before save.
 */

import type { IngestJobPayload } from "@/types/job";
import type { BoardConfig, IJobProvider, RawJob } from "./types";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { isValidJobUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";

const API_BASE = "https://apply.workable.com/api/v3/accounts";

type WorkableJob = {
  id?: string;
  title?: string;
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

function buildLocation(job: WorkableJob): string {
  const parts = [job.city, job.state, job.country, job.region].filter(Boolean);
  return parts.join(", ").trim() || "Unknown";
}

export const workableProvider: IJobProvider = {
  getSourceName: () => "Workable",

  async fetchJobs(board: BoardConfig): Promise<RawJob[]> {
    const url = `${API_BASE}/${board.boardKey}/jobs?state=published`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Workable fetch failed ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { results?: WorkableJob[] };
    return ((json.results ?? []) as unknown) as RawJob[];
  },

  normalizeJob(raw: RawJob, board: BoardConfig): IngestJobPayload | null {
    const job = raw as WorkableJob;
    const id = job.id;
    const title = job.title?.trim();
    if (!id || !title) return null;
    const baseUrl = "https://apply.workable.com";
    const rawUrl = job.url ?? job.application_url ?? "";
    const url = normalizeToAbsoluteUrl(rawUrl, baseUrl) ?? rawUrl;
    const location = buildLocation(job);
    const workModeText = job.workplace ?? job.employment_type ?? location;
    const now = new Date();
    const payload = normalizeIngestPayload({
      source: this.getSourceName(),
      externalId: id,
      title,
      company: board.companyName,
      location,
      url,
      description: job.description ?? "",
      workModeText,
      skills: [],
      postedAt: job.updated_at ?? job.created_at ?? null,
      foundAt: now
    });
    (payload as IngestJobPayload & { country?: string }).country = board.country;
    (payload as IngestJobPayload & { remoteSupport?: boolean }).remoteSupport = board.remoteSupport;
    return payload;
  },

  validateJob(payload: IngestJobPayload): boolean {
    if (!payload.title?.trim() || !payload.company?.trim() || !payload.source?.trim()) return false;
    if (!payload.externalId?.trim() && !payload.hash) return false;
    return isValidJobUrl(payload.url);
  }
};
