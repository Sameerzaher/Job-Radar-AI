/**
 * Provider adapter architecture
 * ----------------------------
 * Each provider (greenhouse, lever, workable, custom) implements IJobProvider.
 * The sync engine loads boards from the registry, groups by provider, and calls
 * fetchJobs(board) for each board. normalizeJob() and validateJob() ensure
 * consistent shape and strict validation before saving.
 */

import type { IngestJobPayload } from "@/types/job";

/** Board config as supplied by the registry (see config/boardRegistry.ts). */
export interface BoardConfig {
  id: string;
  provider: "greenhouse" | "lever" | "workable" | "linkedin" | "custom";
  companyName: string;
  boardKey: string;
  boardUrl: string;
  enabled: boolean;
  tags: string[];
  priority: number;
  country: string;
  remoteSupport: boolean;
  /** Optional: search URL for providers like LinkedIn that use Playwright scraping. */
  searchUrl?: string;
}

/** Raw job shape from provider API (opaque; each provider has its own). */
export type RawJob = Record<string, unknown>;

/**
 * Common interface for all job providers.
 * Implement in services/providers/greenhouseProvider.ts etc.
 */
export interface IJobProvider {
  /** Fetch jobs from the board API. Returns raw items; normalizeJob is applied per item. */
  fetchJobs(board: BoardConfig): Promise<RawJob[]>;
  /** Turn a raw job + board into IngestJobPayload. */
  normalizeJob(raw: RawJob, board: BoardConfig): IngestJobPayload | null;
  /** Return true if payload has valid URL, title, company, source, externalId. */
  validateJob(payload: IngestJobPayload): boolean;
  /** Display name for logs (e.g. "Greenhouse"). */
  getSourceName(): string;
}

export type ProviderName = BoardConfig["provider"];
