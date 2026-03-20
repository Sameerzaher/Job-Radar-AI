import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IApplyProfile extends Document {
  userId: Types.ObjectId;
  name: string;
  isDefault: boolean;
  targetRoles: string[];
  preferredKeywords: string[];
  excludedKeywords: string[];
  seniorityTargets: string[];
  preferredLocations: string[];
  remoteOnly: boolean;
  resumeFilePath: string;
  resumeText: string;
  coverLetterTemplate: string;
  recruiterMessageTemplate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApplyProfileSchema = new Schema<IApplyProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    targetRoles: [{ type: String }],
    preferredKeywords: [{ type: String }],
    excludedKeywords: [{ type: String }],
    seniorityTargets: [{ type: String }],
    preferredLocations: [{ type: String }],
    remoteOnly: { type: Boolean, default: false },
    resumeFilePath: { type: String, default: "" },
    resumeText: { type: String, default: "" },
    coverLetterTemplate: { type: String, default: "" },
    recruiterMessageTemplate: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ApplyProfileSchema.index({ userId: 1, isDefault: 1 });

export const ApplyProfile =
  models.ApplyProfile || model<IApplyProfile>("ApplyProfile", ApplyProfileSchema);
