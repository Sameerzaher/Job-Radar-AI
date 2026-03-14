import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { BoardSyncLog } from "@/models/BoardSyncLog";
import { getEnabledBoards, getAllBoards } from "@/config/boardRegistry";

export interface DiscoveryMetrics {
  totalActiveBoards: number;
  jobsFetchedToday: number;
  jobsSavedToday: number;
  jobsByProvider: Record<string, number>;
  topBoardsByVolume: Array<{ boardId: string; companyName: string; saved: number }>;
  syncFailuresByProvider: Record<string, number>;
}

export async function getDiscoveryMetrics(): Promise<DiscoveryMetrics> {
  await connectToDatabase();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const enabledBoards = getEnabledBoards();
  const allBoards = getAllBoards();

  const [syncLogsToday, jobCountBySource, boardStats] = await Promise.all([
    BoardSyncLog.find({ completedAt: { $gte: startOfToday } }).lean(),
    Job.aggregate<{ _id: string; count: number }>([
      { $match: { foundAt: { $gte: startOfToday } } },
      { $group: { _id: "$source", count: { $sum: 1 } } }
    ]),
    BoardSyncLog.aggregate<{ _id: string; companyName: string; saved: number }>([
      { $match: { completedAt: { $gte: startOfToday } } },
      { $group: { _id: "$boardId", companyName: { $first: "$companyName" }, saved: { $sum: "$saved" } } },
      { $sort: { saved: -1 } },
      { $limit: 10 }
    ])
  ]);

  let jobsFetchedToday = 0;
  let jobsSavedToday = 0;
  const failuresByProvider: Record<string, number> = {};

  for (const log of syncLogsToday as Array<{ fetched?: number; saved?: number; failed?: number; provider?: string }>) {
    jobsFetchedToday += log.fetched ?? 0;
    jobsSavedToday += log.saved ?? 0;
    if ((log.failed ?? 0) > 0 && log.provider) {
      failuresByProvider[log.provider] = (failuresByProvider[log.provider] ?? 0) + (log.failed ?? 0);
    }
  }

  const jobsByProvider: Record<string, number> = {};
  for (const r of jobCountBySource) {
    jobsByProvider[r._id ?? "unknown"] = r.count;
  }

  const topBoardsByVolume = boardStats.map((b) => ({
    boardId: b._id,
    companyName: b.companyName ?? "",
    saved: b.saved
  }));

  return {
    totalActiveBoards: enabledBoards.length,
    jobsFetchedToday,
    jobsSavedToday,
    jobsByProvider,
    topBoardsByVolume,
    syncFailuresByProvider: failuresByProvider
  };
}

/** Last sync per board (for /sources page). */
export async function getLastSyncByBoard(): Promise<Record<string, { completedAt: Date; fetched: number; saved: number; failed: number }>> {
  await connectToDatabase();
  const latest = await BoardSyncLog.aggregate<{
    _id: string;
    completedAt: Date;
    fetched: number;
    saved: number;
    failed: number;
  }>([
    { $sort: { completedAt: -1 } },
    { $group: { _id: "$boardId", completedAt: { $first: "$completedAt" }, fetched: { $first: "$fetched" }, saved: { $first: "$saved" }, failed: { $first: "$failed" } } }
  ]);
  const out: Record<string, { completedAt: Date; fetched: number; saved: number; failed: number }> = {};
  for (const r of latest) {
    out[r._id] = { completedAt: r.completedAt, fetched: r.fetched, saved: r.saved, failed: r.failed };
  }
  return out;
}
