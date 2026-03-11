import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ingestJobs } from "@/services/ingestionService";
import { fetchLeverJobs } from "@/services/scrapers/leverScraper";
import { getLeverBoards } from "@/config/publicBoards";

/**
 * GET or POST /api/sync/lever
 * Fetches jobs from all registered Lever boards, saves new ones (valid URL only, deduped by externalId),
 * returns { fetched, saved, skipped, ... } and logs per-board and per-saved job.
 */
async function handleSync(_request: NextRequest) {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  const boards = getLeverBoards();
  let allPayloads: Awaited<ReturnType<typeof fetchLeverJobs>> = [];
  for (const board of boards) {
    const payloads = await fetchLeverJobs({
      company: board.companyKey,
      companyName: board.companyName
    });
    allPayloads = allPayloads.concat(payloads);
  }

  const fetched = allPayloads.length;
  const result = await ingestJobs(user, allPayloads);
  const saved = result.inserted;
  const skipped = result.skipped + result.skippedInvalidUrl;

  console.log("[JobRadar] Lever sync: saved", saved, "duplicates skipped", result.skipped, "invalid URL skipped", result.skippedInvalidUrl);
  result.insertedUrls.forEach((url) => console.log("Saved job:", url));

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
