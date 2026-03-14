import type { JobStatus, JobWorkMode } from "@/models/Job";

export interface IngestJobPayload {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  workMode?: JobWorkMode;
  url: string;
  description?: string;
  skillsExtracted: string[];
  postedAt: Date;
  foundAt: Date;
  hash: string;
  status?: JobStatus;
  /** From board config for filtering. */
  country?: string;
  remoteSupport?: boolean;
}
