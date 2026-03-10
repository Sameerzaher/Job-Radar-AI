import { connectToDatabase } from "@/lib/db";
import { Match, type IMatch, type MatchStatus } from "@/models/Match";
import { Job, type IJob } from "@/models/Job";
import type { IUser } from "@/models/User";

export interface MatchWithJob extends IMatch {
  job: IJob;
}

export interface BoardColumn {
  status: MatchStatus;
  title: string;
  matches: MatchWithJob[];
}

export async function getBoardForUser(user: IUser): Promise<BoardColumn[]> {
  await connectToDatabase();

  const matches = await Match.find({ user: user._id })
    .populate<{ job: IJob }>("job")
    .sort({ createdAt: -1 })
    .lean<MatchWithJob[]>();

  const byStatus: Record<MatchStatus, MatchWithJob[]> = {
    new: [],
    saved: [],
    applied: [],
    interview: [],
    rejected: []
  };

  for (const m of matches) {
    if (!m.job) continue;
    const status = m.status ?? "new";
    byStatus[status].push(m);
  }

  const columns: Array<{ status: MatchStatus; title: string }> = [
    { status: "new", title: "New" },
    { status: "saved", title: "Saved" },
    { status: "applied", title: "Applied" },
    { status: "interview", title: "Interview" },
    { status: "rejected", title: "Rejected" }
  ];

  return columns.map((c) => ({
    status: c.status,
    title: c.title,
    matches: byStatus[c.status]
  }));
}

export async function updateMatchStatus(
  matchId: string,
  status: MatchStatus
): Promise<IMatch | null> {
  await connectToDatabase();

  const update: Partial<IMatch> = { status };
  if (status === "applied") {
    (update as { appliedAt: Date }).appliedAt = new Date();
  }

  const updated = await Match.findByIdAndUpdate(matchId, update, {
    new: true
  }).lean<IMatch | null>();

  return updated;
}

