import { Schema, model, models, type Document } from "mongoose";

export interface IAutoApplyLock extends Document {
  /** Singleton id, e.g. "auto-apply". */
  key: string;
  locked: boolean;
  lockedAt?: Date;
  lockedBy?: string;
  /** Updated periodically while a worker loop is healthy. */
  heartbeatAt?: Date;
  /** Last time a run started. */
  lastRunStartedAt?: Date;
  /** Last time a full run completed (success or failure). */
  lastRunCompletedAt?: Date;
  /** Last run status: success, failed, or error. */
  lastRunStatus?: "success" | "failed" | "error";
  /** Optional summary of the last run (applied/failed/etc). */
  lastRunSummary?: Record<string, unknown>;
  /** Last run error message if status is error or failed. */
  lastError?: string;
  /** PID or worker instance id that last held the lock. */
  workerPid?: string;
}

const AutoApplyLockSchema = new Schema<IAutoApplyLock>(
  {
    key: { type: String, required: true, index: true },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    heartbeatAt: { type: Date },
    lastRunStartedAt: { type: Date },
    lastRunCompletedAt: { type: Date },
    lastRunStatus: { type: String },
    lastRunSummary: { type: Schema.Types.Mixed },
    lastError: { type: String },
    workerPid: { type: String }
  },
  { timestamps: true }
);

export const AutoApplyLock =
  models.AutoApplyLock || model<IAutoApplyLock>("AutoApplyLock", AutoApplyLockSchema);

