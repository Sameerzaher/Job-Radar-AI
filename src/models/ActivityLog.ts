import { Schema, model, models, type Document, type Types } from "mongoose";

export type ActivityLogType = "sync" | "apply" | "review" | "telegram" | "tailoring" | "digest";
export type ActivityLogStatus = "started" | "success" | "failed" | "skipped" | "info";

export interface IActivityLog extends Document {
  type: ActivityLogType;
  source?: string;
  jobId?: Types.ObjectId;
  matchId?: Types.ObjectId;
  status: ActivityLogStatus;
  message: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    type: { type: String, required: true, enum: ["sync", "apply", "review", "telegram", "tailoring", "digest"], index: true },
    source: { type: String, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    matchId: { type: Schema.Types.ObjectId, ref: "Match" },
    status: { type: String, required: true, enum: ["started", "success", "failed", "skipped", "info"], index: true },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ type: 1, createdAt: -1 });

export const ActivityLog = models.ActivityLog || model<IActivityLog>("ActivityLog", ActivityLogSchema);
