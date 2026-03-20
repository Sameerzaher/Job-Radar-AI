import { Schema, model, models, type Document, type Types } from "mongoose";

export type TailoredApplicationStatus =
  | "draft"
  | "generated"
  | "approved"
  | "used"
  | "failed";

export interface ITailoredApplication extends Document {
  user: Types.ObjectId;
  job: Types.ObjectId;
  match: Types.ObjectId;
  status: TailoredApplicationStatus;
  resumeSummary?: string;
  suggestedBulletPoints: string[];
  missingSkills: string[];
  strengths: string[];
  coverLetter?: string;
  recruiterMessage?: string;
  aiModel?: string;
  generatedAt?: Date;
  failureReason?: string | null;
  /** Apply profile used for this tailoring (when using Apply Profiles feature). */
  applyProfileId?: Types.ObjectId;
  applyProfileName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TailoredApplicationSchema = new Schema<ITailoredApplication>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    // Unique index for match is defined via TailoredApplicationSchema.index below
    match: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    status: {
      type: String,
      enum: ["draft", "generated", "approved", "used", "failed"],
      default: "draft"
    },
    resumeSummary: { type: String },
    suggestedBulletPoints: [{ type: String }],
    missingSkills: [{ type: String }],
    strengths: [{ type: String }],
    coverLetter: { type: String },
    recruiterMessage: { type: String },
    aiModel: { type: String },
    generatedAt: { type: Date },
    failureReason: { type: String },
    applyProfileId: { type: Schema.Types.ObjectId, ref: "ApplyProfile" },
    applyProfileName: { type: String }
  },
  { timestamps: true }
);

TailoredApplicationSchema.index({ match: 1 }, { unique: true });

export const TailoredApplication =
  models.TailoredApplication || model<ITailoredApplication>("TailoredApplication", TailoredApplicationSchema);
