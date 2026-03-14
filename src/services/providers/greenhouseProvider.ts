/**
 * Greenhouse provider adapter.
 * Fetches from boards-api.greenhouse.io, normalizes to IngestJobPayload, validates before save.
 */

import type { IngestJobPayload } from "@/types/job";
import type { BoardConfig, IJobProvider, RawJob } from "./types";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { isValidJobUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";

const API_BASE = "https://boards-api.greenhouse.io/v1/boards";

type GreenhouseJob = {
  id?: number;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  content?: string;
};

export const greenhouseProvider: IJobProvider = {
  getSourceName: () => "Greenhouse",

  async fetchJobs(board: BoardConfig): Promise<RawJob[]> {
    const url = `${API_BASE}/${board.boardKey}/jobs?content=true`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Greenhouse fetch failed ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { jobs?: GreenhouseJob[] };
    return (json.jobs ?? []) as RawJob[];
  },

  normalizeJob(raw: RawJob, board: BoardConfig): IngestJobPayload | null {
    const job = raw as GreenhouseJob;
    const id = job.id;
    const title = job.title?.trim();
    if (id == null || !title) return null;
    const boardBaseUrl = `https://boards.greenhouse.io/${board.boardKey}`;
    const rawUrl = job.absolute_url ?? "";
    const url = normalizeToAbsoluteUrl(rawUrl, boardBaseUrl) ?? rawUrl;
    const now = new Date();
    const payload = normalizeIngestPayload({
      source: "Greenhouse",
      externalId: String(id),
      title,
      company: board.companyName,
      location: job.location?.name ?? "Unknown",
      url,
      description: job.content ?? "",
      workModeText: job.location?.name,
      skills: [],
      postedAt: job.updated_at ?? null,
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
