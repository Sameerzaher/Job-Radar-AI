import { Schema, model, models, type Document } from "mongoose";

export type WorkMode = "Remote" | "Hybrid" | "Onsite";

export interface IUser extends Document {
  email: string;
  name: string;
  targetRoles: string[];
  skills: string[];
  preferredLocations: string[];
  workModes: WorkMode[];
  seniority: "junior" | "mid" | "senior" | "junior-mid";
  /** Keywords that reduce score when present in a job (e.g. "PHP", "legacy") */
  excludedKeywords?: string[];
  /** Plain-text resume used for AI tailoring */
  resumeText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    targetRoles: [{ type: String }],
    skills: [{ type: String }],
    preferredLocations: [{ type: String }],
    workModes: [{ type: String }],
    seniority: {
      type: String,
      enum: ["junior", "mid", "senior", "junior-mid"],
      default: "junior-mid"
    },
    excludedKeywords: [{ type: String }],
    resumeText: { type: String }
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);

