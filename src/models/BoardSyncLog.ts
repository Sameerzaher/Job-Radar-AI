import { Schema, model, models, type Document } from "mongoose";

/** Per-board sync run: health tracking for discovery engine. */
export interface IBoardSyncLog extends Document {
  provider: string;
  boardId: string;
  companyName: string;
  startedAt: Date;
  completedAt: Date;
  fetched: number;
  saved: number;
  duplicates: number;
  invalid: number;
  failed: number;
  errorMessage?: string | null;
  createdAt: Date;
}

const BoardSyncLogSchema = new Schema<IBoardSyncLog>(
  {
    provider: { type: String, required: true, index: true },
    boardId: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    fetched: { type: Number, default: 0 },
    saved: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

BoardSyncLogSchema.index({ createdAt: -1 });
BoardSyncLogSchema.index({ boardId: 1, createdAt: -1 });

export const BoardSyncLog = models.BoardSyncLog || model<IBoardSyncLog>("BoardSyncLog", BoardSyncLogSchema);
