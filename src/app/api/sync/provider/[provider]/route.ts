import { NextRequest, NextResponse } from "next/server";
import { runBatchSync } from "@/services/discovery/batchSyncEngine";

type Params = { params: Promise<{ provider: string }> };

/**
 * GET or POST /api/sync/provider/[provider]
 * Run sync for all enabled boards of the given provider (greenhouse, lever, workable).
 * Returns structured sync summary.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { provider } = await params;
  if (!provider) {
    return NextResponse.json({ error: "Provider required" }, { status: 400 });
  }
  try {
    const result = await runBatchSync({ provider });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  return GET(request, { params });
}
