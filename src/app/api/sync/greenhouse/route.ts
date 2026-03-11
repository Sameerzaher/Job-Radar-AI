import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ingestJobs } from "@/services/ingestionService";
import { fetchGreenhouseJobs } from "@/services/scrapers/greenhouseScraper";

/**
 * GET or POST /api/sync/greenhouse
 * Fetches jobs from a Greenhouse board, saves new ones (valid URL only, deduped by externalId),
 * returns { fetched, saved, skipped }.
 *
 * Query or body: boardToken (default "vercel"), companyName (default "Vercel")
 */
async function handleSync(request: NextRequest) {
  let boardToken = "vercel";
  let companyName = "Vercel";
  if (request.method === "GET") {
    const u = new URL(request.url);
    if (u.searchParams.get("boardToken")) boardToken = u.searchParams.get("boardToken")!;
    if (u.searchParams.get("companyName")) companyName = u.searchParams.get("companyName")!;
  } else {
    try {
      const body = await request.json().catch(() => ({}));
      if (body.boardToken) boardToken = String(body.boardToken);
      if (body.companyName) companyName = String(body.companyName);
    } catch {
      // leave defaults
    }
  }

  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  const payloads = await fetchGreenhouseJobs({ boardToken, companyName });
  const fetched = payloads.length;

  const result = await ingestJobs(user, payloads);
  const saved = result.inserted;
  const skipped = result.skipped + result.skippedInvalidUrl;

  return NextResponse.json({
    fetched,
    saved,
    skipped,
    skippedInvalidUrl: result.skippedInvalidUrl,
    duplicatesSkipped: result.skipped,
    errors: result.errors
  });
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
