import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { normalizeToAbsoluteUrl } from "@/lib/urlValidation";
import { normalizeIngestPayload } from "./utils";

type GreenhouseJob = {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url: string;
  updated_at?: string;
  content?: string;
};

export interface GreenhouseSourceConfig {
  /** Greenhouse board token, e.g. yourcompany */
  boardToken: string;
  /** Optional override for API URL */
  apiBaseUrl?: string;
  /** Company name to display in Job entity */
  companyName: string;
}

async function fetchGreenhouseJobs(config: GreenhouseSourceConfig): Promise<GreenhouseJob[]> {
  const base = config.apiBaseUrl ?? "https://boards-api.greenhouse.io/v1/boards";
  const url = `${base}/${config.boardToken}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[JobRadar] Greenhouse fetch failed", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { jobs?: GreenhouseJob[] };
  return json.jobs ?? [];
}

export function createGreenhouseSource(config: GreenhouseSourceConfig): IJobSource {
  const boardBaseUrl = `https://boards.greenhouse.io/${config.boardToken}`;
  return {
    label: `greenhouse:${config.boardToken}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      const rawJobs = await fetchGreenhouseJobs(config);
      const now = new Date();
      return rawJobs.map((job) => {
        const rawUrl = job.absolute_url ?? "";
        const url = normalizeToAbsoluteUrl(rawUrl, boardBaseUrl) ?? rawUrl;
        return normalizeIngestPayload({
          source: "Greenhouse",
          externalId: String(job.id),
          title: job.title,
          company: config.companyName,
          location: job.location?.name ?? "Unknown",
          url,
          description: job.content ?? "",
          workModeText: job.location?.name,
          skills: [],
          postedAt: job.updated_at ?? null,
          foundAt: now
        });
      });
    }
  };
}

