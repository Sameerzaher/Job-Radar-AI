import { connectToDatabase } from "@/lib/db";
import { BoardSettings } from "@/models/BoardSettings";
import {
  getAllBoards,
  getBoardById,
  loadBoardSettingsFromDb,
  getBoardEnabled
} from "@/config/boardRegistry";
import type { BoardConfig } from "@/services/providers/types";
import { getLastSyncByBoard } from "./discoveryMetrics";

export interface BoardWithMeta extends BoardConfig {
  enabled: boolean;
  lastSync?: { completedAt: Date; fetched: number; saved: number; failed: number };
}

export async function getBoardsWithMeta(): Promise<BoardWithMeta[]> {
  await loadBoardSettingsFromDb();
  const boards = getAllBoards();
  const lastSync = await getLastSyncByBoard();

  return boards.map((b) => ({
    ...b,
    enabled: getBoardEnabled(b),
    lastSync: lastSync[b.id]
  }));
}

export async function setBoardEnabled(boardId: string, enabled: boolean): Promise<boolean> {
  await connectToDatabase();
  const board = getBoardById(boardId);
  if (!board) return false;
  await BoardSettings.findOneAndUpdate(
    { boardId },
    { boardId, enabled },
    { upsert: true, new: true }
  );
  return true;
}
