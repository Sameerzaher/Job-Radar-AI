import { connectToDatabase } from "@/lib/db";
import { ActivityLog } from "@/models/ActivityLog";
import type { ActivityLogType, ActivityLogStatus } from "@/models/ActivityLog";

export interface LogActivityParams {
  type: ActivityLogType;
  source?: string;
  jobId?: string;
  matchId?: string;
  status: ActivityLogStatus;
  message: string;
  details?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await connectToDatabase();
    await ActivityLog.create({
      type: params.type,
      source: params.source,
      jobId: params.jobId,
      matchId: params.matchId,
      status: params.status,
      message: params.message,
      details: params.details
    });
  } catch (e) {
    console.error("[JobRadar] ActivityLog write failed:", e);
  }
}
