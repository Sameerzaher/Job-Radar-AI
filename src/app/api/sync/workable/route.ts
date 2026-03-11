import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ingestJobs } from "@/services/ingestionService";
import { fetchWorkableJobs } from "@/services/scrapers/workableScraper";
import { getWorkableBoards } from "@/config/publicBoards";

/**
 * GET or POST /api/sync/workable
 * Fetches jobs from all registered Workable boards, saves new ones (valid URL only, deduped by externalId),
 * returns { fetched, saved, skipped, ... }.
 */
async function handleSync(_request: NextRequest) {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  const boards = getWorkableBoards();
  let allPayloads: Awaited<ReturnType<typeof fetchWorkableJobs>> = [];
  for (const board of boards) {
    const payloads = await fetchWorkableJobs({
      account: board.companyKey,
      companyName: board.companyName
    });
    allPayloads = allPayloads.concat(payloads);
  }

  const fetched = allPayloads.length;
  const result = await ingestJobs(user, allPayloads);
  const saved = result.inserted;
  const skipped = result.skipped + result.skippedInvalidUrl;

  console.log("[JobRadar] Workable sync: saved", saved, "duplicates skipped", result.skipped, "invalid URL skipped", result.skippedInvalidUrl);

  return NextResponse.json({
    fetched,
    saved,
    skipped,
    skippedInvalidUrl: result.skippedInvalidUrl,
    duplicatesSkipped: result.skipped,
    errors: result.errors,
    boards: boards.map((b) => b.companyKey)
  });
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
