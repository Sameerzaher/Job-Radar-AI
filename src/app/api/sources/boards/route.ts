import { NextResponse } from "next/server";
import { getBoardsWithMeta } from "@/services/discovery/boardService";

/**
 * GET /api/sources/boards
 * List all boards with enabled state and last sync info.
 */
export async function GET() {
  try {
    const boards = await getBoardsWithMeta();
    return NextResponse.json(boards);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
