import { NextRequest, NextResponse } from "next/server";
import { runBatchSync } from "@/services/discovery/batchSyncEngine";

type Params = { params: Promise<{ id: string }> };

/**
 * GET or POST /api/sync/board/[id]
 * Run sync for a single board by id.
 * Returns structured sync summary.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Board id required" }, { status: 400 });
  }
  try {
    const result = await runBatchSync({ boardId: id });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  return GET(request, { params });
}
