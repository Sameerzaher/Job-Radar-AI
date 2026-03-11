import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ingestJobs } from "@/services/ingestionService";
import { fetchGreenhouseJobs } from "@/services/scrapers/greenhouseScraper";
import { fetchLeverJobs } from "@/services/scrapers/leverScraper";
import { fetchWorkableJobs } from "@/services/scrapers/workableScraper";
import { getGreenhouseBoards, getLeverBoards, getWorkableBoards } from "@/config/publicBoards";

export type SourceSummary = {
  fetched: number;
  saved: number;
  skipped: number;
  skippedInvalidUrl: number;
  duplicatesSkipped: number;
  errors: string[];
};

/**
 * GET or POST /api/sync/all
 * Runs Greenhouse, Lever, then Workable sync; returns combined summary and per-source totals.
 */
async function handleSync(_request: NextRequest) {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  // Greenhouse: all boards
  const ghBoards = getGreenhouseBoards();
  let ghPayloads: Awaited<ReturnType<typeof fetchGreenhouseJobs>> = [];
  for (const board of ghBoards) {
    const payloads = await fetchGreenhouseJobs({
      boardToken: board.companyKey,
      companyName: board.companyName
    });
    ghPayloads = ghPayloads.concat(payloads);
  }
  const greenhouseResult = await ingestJobs(user, ghPayloads);
  const greenhouse: SourceSummary = {
    fetched: ghPayloads.length,
    saved: greenhouseResult.inserted,
    skipped: greenhouseResult.skipped + greenhouseResult.skippedInvalidUrl,
    skippedInvalidUrl: greenhouseResult.skippedInvalidUrl,
    duplicatesSkipped: greenhouseResult.skipped,
    errors: greenhouseResult.errors
  };

  // Lever: all boards
  const leverBoards = getLeverBoards();
  let leverPayloads: Awaited<ReturnType<typeof fetchLeverJobs>> = [];
  for (const board of leverBoards) {
    const payloads = await fetchLeverJobs({
      company: board.companyKey,
      companyName: board.companyName
    });
    leverPayloads = leverPayloads.concat(payloads);
  }
  const leverResult = await ingestJobs(user, leverPayloads);
  const lever: SourceSummary = {
    fetched: leverPayloads.length,
    saved: leverResult.inserted,
    skipped: leverResult.skipped + leverResult.skippedInvalidUrl,
    skippedInvalidUrl: leverResult.skippedInvalidUrl,
    duplicatesSkipped: leverResult.skipped,
    errors: leverResult.errors
  };

  // Workable: all boards
  const workableBoards = getWorkableBoards();
  let workablePayloads: Awaited<ReturnType<typeof fetchWorkableJobs>> = [];
  for (const board of workableBoards) {
    const payloads = await fetchWorkableJobs({
      account: board.companyKey,
      companyName: board.companyName
    });
    workablePayloads = workablePayloads.concat(payloads);
  }
  const workableResult = await ingestJobs(user, workablePayloads);
  const workable: SourceSummary = {
    fetched: workablePayloads.length,
    saved: workableResult.inserted,
    skipped: workableResult.skipped + workableResult.skippedInvalidUrl,
    skippedInvalidUrl: workableResult.skippedInvalidUrl,
    duplicatesSkipped: workableResult.skipped,
    errors: workableResult.errors
  };

  const fetched = greenhouse.fetched + lever.fetched + workable.fetched;
  const saved = greenhouse.saved + lever.saved + workable.saved;
  const skipped = greenhouse.skipped + lever.skipped + workable.skipped;
  const skippedInvalidUrl = greenhouse.skippedInvalidUrl + lever.skippedInvalidUrl + workable.skippedInvalidUrl;
  const duplicatesSkipped = greenhouse.duplicatesSkipped + lever.duplicatesSkipped + workable.duplicatesSkipped;
  const errors = [...greenhouse.errors, ...lever.errors, ...workable.errors];

  return NextResponse.json({
    fetched,
    saved,
    skipped,
    skippedInvalidUrl,
    duplicatesSkipped,
    errors,
    greenhouse,
    lever,
    workable
  });
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
