import { Schema, model, models, type Document } from "mongoose";

export interface ISyncLog extends Document {
  startedAt: Date;
  finishedAt: Date;
  jobsFetched: number;
  jobsInserted: number;
  duplicatesSkipped: number;
  skippedInvalidUrl: number;
  matchesCreated: number;
  errors: string[];
  sourceLabel: string;
  createdAt: Date;
}

const SyncLogSchema = new Schema<ISyncLog>(
  {
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    jobsFetched: { type: Number, required: true, default: 0 },
    jobsInserted: { type: Number, required: true, default: 0 },
    duplicatesSkipped: { type: Number, required: true, default: 0 },
    skippedInvalidUrl: { type: Number, required: true, default: 0 },
    matchesCreated: { type: Number, required: true, default: 0 },
    errors: [{ type: String }],
    sourceLabel: { type: String, required: true, default: "unknown" }
  },
  {
    timestamps: true,
    // Mongoose reserves "errors" on documents; we intentionally store an "errors" array here
    // and suppress the warning to avoid noisy logs.
    // See https://mongoosejs.com/docs/8.x/docs/guide.html#suppressReservedKeysWarning
    suppressReservedKeysWarning: true
  } as unknown as undefined
);

SyncLogSchema.index({ createdAt: -1 });

export const SyncLog = models.SyncLog || model<ISyncLog>("SyncLog", SyncLogSchema);
