import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ingestJobs } from "@/services/ingestionService";
import { SyncLog, type ISyncLog } from "@/models/SyncLog";
import { syncLogger } from "@/lib/logger";
import type { IJobSource } from "./sources/types";
import { getPrimaryJobSources, getOptionalPlaywrightSource } from "@/config/sourceRegistry";

export interface SyncResult {
  startedAt: Date;
  finishedAt: Date;
  jobsFetched: number;
  jobsInserted: number;
  duplicatesSkipped: number;
  skippedInvalidUrl: number;
  matchesCreated: number;
  errors: string[];
  sourceLabel: string;
}

/**
 * Run one sync: fetch jobs from the given source, ingest (dedupe), log, and persist run to SyncLog.
 * Uses the default user for match creation.
 * Pass an IJobSource (e.g. sampleJobSource or a future Playwright scraper).
 */
export async function runSync(source: IJobSource): Promise<SyncResult> {
  const startedAt = new Date();
  syncLogger.syncStarted(source.label);

  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  let payloads: Awaited<ReturnType<IJobSource["fetchJobs"]>>;
  try {
    payloads = await source.fetchJobs();
  } catch (err) {
    syncLogger.syncError("Failed to fetch jobs", err);
    const finishedAt = new Date();
    const logEntry = await SyncLog.create({
      startedAt,
      finishedAt,
      jobsFetched: 0,
      jobsInserted: 0,
      duplicatesSkipped: 0,
      skippedInvalidUrl: 0,
      matchesCreated: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      sourceLabel: source.label
    });
    return toResult(logEntry);
  }

  const jobsFetched = payloads.length;
  syncLogger.jobsFetched(jobsFetched);

  const ingestResult = await ingestJobs(user, payloads);
  syncLogger.jobsInserted(ingestResult.inserted);
  syncLogger.duplicatesSkipped(ingestResult.skipped);
  syncLogger.skippedInvalidUrl(ingestResult.skippedInvalidUrl);
  if (ingestResult.insertedUrls.length > 0) {
    syncLogger.realUrlsCaptured(ingestResult.insertedUrls);
  }
  syncLogger.matchesCreated(ingestResult.inserted);

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  syncLogger.syncFinished(durationMs, ingestResult.errors.length);

  const logEntry = await SyncLog.create({
    startedAt,
    finishedAt,
    jobsFetched,
    jobsInserted: ingestResult.inserted,
    duplicatesSkipped: ingestResult.skipped,
    skippedInvalidUrl: ingestResult.skippedInvalidUrl,
    matchesCreated: ingestResult.inserted,
    errors: ingestResult.errors,
    sourceLabel: source.label
  });

  return toResult(logEntry);
}

function toResult(log: ISyncLog): SyncResult {
  return {
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    jobsFetched: log.jobsFetched,
    jobsInserted: log.jobsInserted,
    duplicatesSkipped: log.duplicatesSkipped,
    skippedInvalidUrl: (log as ISyncLog & { skippedInvalidUrl?: number }).skippedInvalidUrl ?? 0,
    matchesCreated: log.matchesCreated,
    errors: log.errors ?? [],
    sourceLabel: log.sourceLabel
  };
}

/**
 * Run sync from primary source (Greenhouse only for first implementation).
 * Saves only jobs with valid external URLs. No demo/sample.
 */
export async function runSyncAll(): Promise<SyncResult> {
  const startedAt = new Date();
  const sourceLabel = "greenhouse";
  syncLogger.syncStarted(sourceLabel);

  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  const sources = [...getPrimaryJobSources()];
  const playwrightSource = getOptionalPlaywrightSource();
  if (playwrightSource) sources.push(playwrightSource);

  let allPayloads: Awaited<ReturnType<IJobSource["fetchJobs"]>> = [];
  for (const source of sources) {
    try {
      const payloads = await source.fetchJobs();
      allPayloads = allPayloads.concat(payloads);
    } catch (err) {
      syncLogger.syncError(`Fetch failed (${source.label})`, err);
    }
  }

  const jobsFetched = allPayloads.length;
  syncLogger.jobsFetched(jobsFetched);

  const ingestResult = await ingestJobs(user, allPayloads);
  syncLogger.jobsInserted(ingestResult.inserted);
  syncLogger.duplicatesSkipped(ingestResult.skipped);
  syncLogger.skippedInvalidUrl(ingestResult.skippedInvalidUrl);
  if (ingestResult.insertedUrls.length > 0) {
    syncLogger.realUrlsCaptured(ingestResult.insertedUrls);
  }
  syncLogger.matchesCreated(ingestResult.inserted);

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  syncLogger.syncFinished(durationMs, ingestResult.errors.length);

  const logEntry = await SyncLog.create({
    startedAt,
    finishedAt,
    jobsFetched,
    jobsInserted: ingestResult.inserted,
    duplicatesSkipped: ingestResult.skipped,
    skippedInvalidUrl: ingestResult.skippedInvalidUrl,
    matchesCreated: ingestResult.inserted,
    errors: ingestResult.errors,
    sourceLabel
  });

  return toResult(logEntry);
}

/**
 * Get the most recent sync run for dashboard display.
 */
export async function getLastSync(): Promise<SyncResult | null> {
  await connectToDatabase();
  const latest = await SyncLog.findOne().sort({ createdAt: -1 }).lean();
  if (!latest) return null;
  return {
    startedAt: latest.startedAt,
    finishedAt: latest.finishedAt,
    jobsFetched: latest.jobsFetched,
    jobsInserted: latest.jobsInserted,
    duplicatesSkipped: latest.duplicatesSkipped,
    skippedInvalidUrl: (latest as typeof latest & { skippedInvalidUrl?: number }).skippedInvalidUrl ?? 0,
    matchesCreated: latest.matchesCreated,
    errors: latest.errors ?? [],
    sourceLabel: latest.sourceLabel
  };
}
