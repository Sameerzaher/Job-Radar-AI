/**
 * Batch ingestion orchestration.
 * Loads enabled boards, groups by provider, fetches board-by-board with rate limiting,
 * saves only valid jobs, skips duplicates, creates/updates matches.
 */

import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { loadBoardSettingsFromDb, getEnabledBoardsByProvider, getBoardById } from "@/config/boardRegistry";
import { getProvider } from "@/services/providers";
import { ingestJobs } from "@/services/ingestionService";
import { BoardSyncLog } from "@/models/BoardSyncLog";
import { logActivity } from "@/services/activityLogger";
import type { BoardConfig } from "@/services/providers/types";
import type { IngestJobPayload } from "@/types/job";

const DELAY_BETWEEN_BOARDS_MS = 800;
const DELAY_BETWEEN_PROVIDER_GROUPS_MS = 1500;
const MAX_CONCURRENT_PER_PROVIDER = 1;
const RETRY_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error | null = null;
  for (let i = 0; i <= RETRY_ATTEMPTS; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < RETRY_ATTEMPTS) {
        await delay(RETRY_BACKOFF_MS * (i + 1));
      }
    }
  }
  throw lastErr;
}

export interface BoardSyncSummary {
  boardId: string;
  provider: string;
  companyName: string;
  startedAt: Date;
  completedAt: Date;
  fetched: number;
  saved: number;
  duplicates: number;
  invalid: number;
  failed: number;
  errorMessage?: string | null;
}

export interface BatchSyncResult {
  startedAt: Date;
  completedAt: Date;
  boardsRun: number;
  boardsFailed: number;
  totalFetched: number;
  totalSaved: number;
  totalDuplicates: number;
  totalInvalid: number;
  totalErrors: number;
  byBoard: BoardSyncSummary[];
}

export async function runBatchSync(options?: {
  provider?: string;
  boardId?: string;
}): Promise<BatchSyncResult> {
  await connectToDatabase();
  await loadBoardSettingsFromDb();
  const user = await getOrCreateDefaultUser();

  const startedAt = new Date();
  const byBoard: BoardSyncSummary[] = [];
  let boardsRun = 0;
  let boardsFailed = 0;
  let totalFetched = 0;
  let totalSaved = 0;
  let totalDuplicates = 0;
  let totalInvalid = 0;
  let totalErrors = 0;

  let boardsToRun: BoardConfig[];
  if (options?.boardId) {
    const board = getBoardById(options.boardId);
    boardsToRun = board ? [board] : [];
  } else if (options?.provider) {
    const byProvider = getEnabledBoardsByProvider();
    boardsToRun = byProvider.get(options.provider) ?? [];
  } else {
    const byProvider = getEnabledBoardsByProvider();
    boardsToRun = [];
    for (const list of byProvider.values()) boardsToRun.push(...list);
  }

  for (const board of boardsToRun) {
    const providerImpl = getProvider(board.provider);
    if (!providerImpl) {
      byBoard.push({
        boardId: board.id,
        provider: board.provider,
        companyName: board.companyName,
        startedAt,
        completedAt: new Date(),
        fetched: 0,
        saved: 0,
        duplicates: 0,
        invalid: 0,
        failed: 1,
        errorMessage: `Unknown provider: ${board.provider}`
      });
      boardsFailed += 1;
      totalErrors += 1;
      continue;
    }

    const boardStarted = new Date();
    let fetched = 0;
    let saved = 0;
    let duplicates = 0;
    let invalid = 0;
    let errorMessage: string | null = null;

    try {
      const rawJobs = await withRetry(
        () => providerImpl.fetchJobs(board),
        `fetch ${board.id}`
      );
      fetched = rawJobs.length;

      const payloads: IngestJobPayload[] = [];
      for (const raw of rawJobs) {
        const payload = providerImpl.normalizeJob(raw, board);
        if (!payload) {
          invalid += 1;
          continue;
        }
        if (!providerImpl.validateJob(payload)) {
          invalid += 1;
          continue;
        }
        payloads.push(payload);
      }

      await delay(DELAY_BETWEEN_BOARDS_MS);

      const ingestResult = await ingestJobs(user, payloads);
      saved = ingestResult.inserted;
      duplicates = ingestResult.skipped;
      invalid += ingestResult.skippedInvalidUrl;
      if (ingestResult.errors.length) {
        errorMessage = ingestResult.errors.slice(0, 3).join("; ");
        totalErrors += ingestResult.errors.length;
      }
      boardsRun += 1;
      totalFetched += fetched;
      totalSaved += saved;
      totalDuplicates += duplicates;
      totalInvalid += invalid;
    } catch (e) {
      boardsFailed += 1;
      totalErrors += 1;
      errorMessage = e instanceof Error ? e.message : String(e);
      await logActivity({
        type: "sync",
        source: board.id,
        status: "failed",
        message: "Board sync failed",
        details: { boardId: board.id, error: errorMessage }
      });
    }

    const completedAt = new Date();
    await BoardSyncLog.create({
      provider: board.provider,
      boardId: board.id,
      companyName: board.companyName,
      startedAt: boardStarted,
      completedAt,
      fetched,
      saved,
      duplicates,
      invalid,
      failed: errorMessage ? 1 : 0,
      errorMessage
    });

    byBoard.push({
      boardId: board.id,
      provider: board.provider,
      companyName: board.companyName,
      startedAt: boardStarted,
      completedAt,
      fetched,
      saved,
      duplicates,
      invalid,
      failed: errorMessage ? 1 : 0,
      errorMessage
    });
  }

  const completedAt = new Date();
  await logActivity({
    type: "sync",
    source: "batch",
    status: boardsFailed > 0 ? "failed" : "success",
    message: "Batch sync completed",
    details: {
      boardsRun,
      boardsFailed,
      totalFetched,
      totalSaved,
      totalDuplicates,
      totalInvalid,
      totalErrors
    }
  });

  return {
    startedAt,
    completedAt,
    boardsRun,
    boardsFailed,
    totalFetched,
    totalSaved,
    totalDuplicates,
    totalInvalid,
    totalErrors,
    byBoard
  };
}
