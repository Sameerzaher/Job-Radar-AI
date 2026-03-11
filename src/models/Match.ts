import { Schema, model, models, type Document, type Types } from "mongoose";

export type AIRecommendation = "apply" | "maybe" | "skip";

export type MatchStatus = "new" | "saved" | "applied" | "interview" | "rejected";

export type ApplicationStatus =
  | "new"
  | "queued"
  | "ready_for_review"
  | "approved"
  | "applying"
  | "applied"
  | "failed"
  | "needs_review"
  | "rejected";

export type ApplicationMethod = "greenhouse" | "lever" | "workable" | "manual";

export interface IMatch extends Document {
  user: Types.ObjectId;
  job: Types.ObjectId;
  score: number;
  reasons: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  status: MatchStatus;
  appliedAt?: Date;
  /** Auto-apply workflow state */
  applicationStatus?: ApplicationStatus;
  autoApplied?: boolean;
  applicationMethod?: ApplicationMethod;
  telegramSent?: boolean;
  failureReason?: string | null;
  aiSummary?: string;
  whyItMatches?: string;
  aiMissingSkills?: string[];
  recommendation?: AIRecommendation;
  tailoredResumeSummary?: string;
  tailoredBulletPoints?: string[];
  tailoredCoverLetter?: string;
  /** True when this application was submitted using tailored cover letter (from TailoredApplication). */
  tailoredUsedInApply?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    score: { type: Number, required: true },
    reasons: [{ type: String }],
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],
    status: {
      type: String,
      enum: ["new", "saved", "applied", "interview", "rejected"],
      default: "new",
      index: true
    },
    appliedAt: { type: Date },
    applicationStatus: {
      type: String,
      enum: ["new", "queued", "ready_for_review", "approved", "applying", "applied", "failed", "needs_review", "rejected"],
      default: "new",
      index: true
    },
    autoApplied: { type: Boolean, default: false },
    applicationMethod: { type: String, enum: ["greenhouse", "lever", "workable", "manual"] },
    telegramSent: { type: Boolean, default: false },
    failureReason: { type: String },
    aiSummary: { type: String },
    whyItMatches: { type: String },
    aiMissingSkills: [{ type: String }],
    recommendation: { type: String, enum: ["apply", "maybe", "skip"] },
    tailoredResumeSummary: { type: String },
    tailoredBulletPoints: [{ type: String }],
    tailoredCoverLetter: { type: String },
    tailoredUsedInApply: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Match = models.Match || model<IMatch>("Match", MatchSchema);

