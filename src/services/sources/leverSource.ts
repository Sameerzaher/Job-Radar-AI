import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";
import { normalizeIngestPayload } from "./utils";

type LeverJob = {
  id: string;
  text: string;
  categories?: {
    location?: string;
    team?: string;
  };
  hostedUrl: string;
  createdAt?: number;
  descriptionPlain?: string;
};

export interface LeverSourceConfig {
  /** Lever company slug, e.g. yourcompany */
  company: string;
}

async function fetchLeverJobs(config: LeverSourceConfig): Promise<LeverJob[]> {
  const url = `https://api.lever.co/v0/postings/${config.company}?mode=json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[JobRadar] Lever fetch failed", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as LeverJob[];
  return json ?? [];
}

export function createLeverSource(config: LeverSourceConfig): IJobSource {
  return {
    label: `lever:${config.company}`,
    async fetchJobs(): Promise<IngestJobPayload[]> {
      const rawJobs = await fetchLeverJobs(config);
      const now = new Date();
      return rawJobs.map((job) =>
        normalizeIngestPayload({
          source: "Lever",
          externalId: job.id,
          title: job.text,
          company: config.company,
          location: job.categories?.location ?? "Unknown",
          url: job.hostedUrl,
          description: job.descriptionPlain ?? "",
          workModeText: job.categories?.location,
          skills: [],
          postedAt: job.createdAt ? new Date(job.createdAt) : null,
          foundAt: now
        })
      );
    }
  };
}

