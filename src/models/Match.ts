import { Schema, model, models, type Document, type Types } from "mongoose";

export type AIRecommendation = "apply" | "maybe" | "skip";

export type MatchStatus = "new" | "saved" | "applied" | "interview" | "rejected";

export interface IMatch extends Document {
  user: Types.ObjectId;
  job: Types.ObjectId;
  score: number;
  reasons: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  status: MatchStatus;
  appliedAt?: Date;
  aiSummary?: string;
  whyItMatches?: string;
  aiMissingSkills?: string[];
  recommendation?: AIRecommendation;
   tailoredResumeSummary?: string;
   tailoredBulletPoints?: string[];
   tailoredCoverLetter?: string;
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
    aiSummary: { type: String },
    whyItMatches: { type: String },
    aiMissingSkills: [{ type: String }],
    recommendation: { type: String, enum: ["apply", "maybe", "skip"] },
    tailoredResumeSummary: { type: String },
    tailoredBulletPoints: [{ type: String }],
    tailoredCoverLetter: { type: String }
  },
  { timestamps: true }
);

export const Match = models.Match || model<IMatch>("Match", MatchSchema);

