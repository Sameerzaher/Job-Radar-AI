import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { normalizeIngestPayload } from "./utils";

type WorkableJob = {
  id: string;
  title: string;
  city?: string;
  state?: string;
  country?: string;
  url: string;
  description?: string;
  updated_at?: string;
};

export interface WorkableSourceConfig {
  /** Workable subdomain/account, e.g. yourcompany */
  account: string;
  /** Optional API base URL override */
  apiBaseUrl?: string;
  /** Company name to display in Job entity */
  companyName: string;
}

async function fetchWorkableJobs(config: WorkableSourceConfig): Promise<WorkableJob[]> {
  const base = config.apiBaseUrl ?? "https://apply.workable.com/api/v3/accounts";
  const url = `${base}/${config.account}/jobs?state=published`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[JobRadar] Workable fetch failed", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { results?: WorkableJob[] };
  return json.results ?? [];
}

export function createWorkableSource(config: WorkableSourceConfig): IJobSource {
  return {
    label: `workable:${config.account}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      const rawJobs = await fetchWorkableJobs(config);
      const now = new Date();
      return rawJobs.map((job) => {
        const locParts = [job.city, job.state, job.country].filter(Boolean);
        return normalizeIngestPayload({
          source: "Workable",
          externalId: job.id,
          title: job.title,
          company: config.companyName,
          location: locParts.join(", ") || "Unknown",
          url: job.url,
          description: job.description ?? "",
          workModeText: locParts.join(", "),
          skills: [],
          postedAt: job.updated_at ?? null,
          foundAt: now
        });
      });
    }
  };
}

