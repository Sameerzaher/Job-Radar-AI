/**
 * Lever provider adapter.
 * Fetches from api.lever.co postings API, normalizes to IngestJobPayload, validates before save.
 */

import type { IngestJobPayload } from "@/types/job";
import type { BoardConfig, IJobProvider, RawJob } from "./types";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { isValidJobUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "@/services/sources/utils";

const API_BASE = "https://api.lever.co/v0/postings";

type LeverJob = {
  id?: string;
  text?: string;
  categories?: { location?: string; team?: string; commitment?: string; department?: string };
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  description?: string;
  descriptionPlain?: string;
};

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

export const leverProvider: IJobProvider = {
  getSourceName: () => "Lever",

  async fetchJobs(board: BoardConfig): Promise<RawJob[]> {
    const url = `${API_BASE}/${board.boardKey}?mode=json`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Lever fetch failed ${res.status}: ${body}`);
    }
    const raw = (await res.json()) as LeverJob[] | unknown;
    return Array.isArray(raw) ? (raw as RawJob[]) : [];
  },

  normalizeJob(raw: RawJob, board: BoardConfig): IngestJobPayload | null {
    const job = raw as LeverJob;
    const id = job.id;
    const title = job.text?.trim();
    if (!id || !title) return null;
    const baseUrl = "https://api.lever.co";
    const rawUrl = job.hostedUrl ?? job.applyUrl ?? "";
    const url = normalizeToAbsoluteUrl(rawUrl, baseUrl) ?? rawUrl;
    const now = new Date();
    const payload = normalizeIngestPayload({
      source: "Lever",
      externalId: id,
      title,
      company: board.companyName,
      location: job.categories?.location ?? "Unknown",
      url,
      description: buildDescription(job),
      workModeText: job.categories?.location,
      skills: [],
      postedAt: job.createdAt != null ? new Date(job.createdAt) : null,
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
