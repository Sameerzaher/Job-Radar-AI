import { NextRequest, NextResponse } from "next/server";
import { runDigest } from "@/services/digestService";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_API_KEY) return true;
  const key =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === ADMIN_API_KEY;
}

/**
 * GET or POST /api/cron/digest
 * Runs the Telegram digest (new high-match jobs + status changes since last digest).
 * Optional: set ADMIN_API_KEY and send x-api-key or Authorization: Bearer <key>.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDigest();
  return NextResponse.json({
    ok: result.sent,
    sent: result.sent,
    error: result.error
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDigest();
  return NextResponse.json({
    ok: result.sent,
    sent: result.sent,
    error: result.error
  });
}
