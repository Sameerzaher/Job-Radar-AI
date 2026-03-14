import { Schema, model, models, type Document } from "mongoose";

/** Per-board override for enabled. Keyed by board id from boardRegistry. */
export interface IBoardSettings extends Document {
  boardId: string;
  enabled: boolean;
  updatedAt: Date;
}

const BoardSettingsSchema = new Schema<IBoardSettings>(
  { boardId: { type: String, required: true, unique: true }, enabled: { type: Boolean, required: true } },
  { timestamps: true }
);

export const BoardSettings = models.BoardSettings || model<IBoardSettings>("BoardSettings", BoardSettingsSchema);
