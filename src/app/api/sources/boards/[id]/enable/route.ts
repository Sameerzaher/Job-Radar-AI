import { NextRequest, NextResponse } from "next/server";
import { setBoardEnabled } from "@/services/discovery/boardService";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/sources/boards/[id]/enable
 * Body: { enabled: boolean }
 * Enable or disable a board.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Board id required" }, { status: 400 });
  }
  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const enabled = body.enabled === true || body.enabled === false ? body.enabled : undefined;
  if (enabled === undefined) {
    return NextResponse.json({ error: "enabled (boolean) required" }, { status: 400 });
  }
  const ok = await setBoardEnabled(id, enabled);
  if (!ok) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  return NextResponse.json({ ok: true, boardId: id, enabled });
}
