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
  /** Plain-text resume used for AI tailoring (base resume content) */
  resumeText?: string;
  /** Base resume text for tailoring (if not set, resumeText is used) */
  baseResumeText?: string;
  /** Optional default cover letter template for tailoring */
  defaultCoverLetterTemplate?: string;
  /** Years of experience (e.g. "5") */
  yearsOfExperience?: string;
  /** Key projects for tailoring */
  keyProjects?: string[];
  /** Key achievements */
  achievements?: string[];
  /** Application profile for auto-apply */
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  /** Server path to resume file for upload (e.g. /app/data/resume.pdf) */
  resumeFilePath?: string;
  defaultCoverLetter?: string;
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
    resumeText: { type: String },
    baseResumeText: { type: String },
    defaultCoverLetterTemplate: { type: String },
    yearsOfExperience: { type: String },
    keyProjects: [{ type: String }],
    achievements: [{ type: String }],
    phone: { type: String },
    linkedinUrl: { type: String },
    githubUrl: { type: String },
    portfolioUrl: { type: String },
    resumeFilePath: { type: String },
    defaultCoverLetter: { type: String }
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);

