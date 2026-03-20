import { Schema, model, models, type Document, type Types } from "mongoose";

export type CompanyMemoryOutcome =
  | "applied"
  | "failed"
  | "needs_review"
  | "rejected"
  | "skipped_rules"
  | "skipped_unsupported";

export interface ICompanyMemory extends Document {
  userId: Types.ObjectId;
  normalizedCompanyName: string;
  displayCompanyName: string;
  lastAppliedAt: Date | null;
  lastAppliedRole: string;
  lastApplyProfileId: Types.ObjectId | null;
  lastApplyProfileName: string;
  totalApplications: number;
  totalApplied: number;
  totalFailed: number;
  totalNeedsReview: number;
  totalRejected: number;
  totalSkippedRules: number;
  totalSkippedUnsupported: number;
  lastOutcome: CompanyMemoryOutcome | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyMemorySchema = new Schema<ICompanyMemory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    normalizedCompanyName: { type: String, required: true, index: true },
    displayCompanyName: { type: String, required: true },
    lastAppliedAt: { type: Date, default: null },
    lastAppliedRole: { type: String, default: "" },
    lastApplyProfileId: { type: Schema.Types.ObjectId, ref: "ApplyProfile", default: null },
    lastApplyProfileName: { type: String, default: "" },
    totalApplications: { type: Number, default: 0 },
    totalApplied: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 },
    totalNeedsReview: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    totalSkippedRules: { type: Number, default: 0 },
    totalSkippedUnsupported: { type: Number, default: 0 },
    lastOutcome: { type: String, enum: ["applied", "failed", "needs_review", "rejected", "skipped_rules", "skipped_unsupported"], default: null },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

CompanyMemorySchema.index({ userId: 1, normalizedCompanyName: 1 }, { unique: true });

export const CompanyMemory =
  models.CompanyMemory || model<ICompanyMemory>("CompanyMemory", CompanyMemorySchema);
