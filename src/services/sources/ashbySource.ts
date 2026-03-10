import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { normalizeIngestPayload } from "./utils";

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  jobUrl: string;
  description?: string;
  updatedAt?: string;
  department?: string;
};

export interface AshbySourceConfig {
  /** Ashby org slug, e.g. yourcompany */
  orgSlug: string;
  /** Optional API base URL override */
  apiBaseUrl?: string;
  /** Company name to display in Job entity */
  companyName: string;
}

async function fetchAshbyJobs(config: AshbySourceConfig): Promise<AshbyJob[]> {
  const base = config.apiBaseUrl ?? "https://jobs.ashbyhq.com/api/posting";
  const url = `${base}/${config.orgSlug}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[JobRadar] Ashby fetch failed", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { jobs?: AshbyJob[] };
  return json.jobs ?? [];
}

export function createAshbySource(config: AshbySourceConfig): IJobSource {
  return {
    label: `ashby:${config.orgSlug}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      const rawJobs = await fetchAshbyJobs(config);
      const now = new Date();
      return rawJobs.map((job) =>
        normalizeIngestPayload({
          source: "Ashby",
          externalId: job.id,
          title: job.title,
          company: config.companyName,
          location: job.location ?? "Unknown",
          url: job.jobUrl,
          description: job.description ?? "",
          workModeText: job.location,
          skills: job.department ? [job.department] : [],
          postedAt: job.updatedAt ?? null,
          foundAt: now
        })
      );
    }
  };
}

