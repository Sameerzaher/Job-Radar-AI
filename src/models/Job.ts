import { Schema, model, models, type Document, type Types } from "mongoose";

export type JobStatus = "new" | "interested" | "applied" | "saved" | "rejected" | "archived";

export type JobWorkMode = "Remote" | "Hybrid" | "Onsite";

export interface IJob extends Document {
  source: string;
  externalId?: string;
  title: string;
  company: string;
  location: string;
  workMode?: JobWorkMode;
  /** Original external job posting URL (http/https). Used for "Open Job" / "Open Original Posting". */
  url?: string;
  /** @deprecated Prefer url. Kept for backward compatibility. */
  externalUrl?: string;
  description?: string;
  skillsExtracted?: string[];
  postedAt?: Date;
  foundAt?: Date;
  hash?: string;
  status: JobStatus;
  tags: string[];
  /** From board config for filtering (e.g. "US", "global"). */
  country?: string;
  /** From board config for filtering. */
  remoteSupport?: boolean;
  /** Set when a high-match Telegram notification has been sent (once per job) */
  telegramNotifiedAt?: Date;
  /** URL quality from ingestion: supported_apply_url | generic_careers_page | unsupported_custom_careers_page | invalid_url */
  urlClassification?: string;
  /** True only when URL is a supported direct apply URL (Greenhouse/Lever/Workable official hosts). */
  autoApplySupported?: boolean;
  createdAt: Date;
  updatedAt: Date;
  matches?: Types.ObjectId[];
}

const JobSchema = new Schema<IJob>(
  {
    source: { type: String, required: true, index: true },
    externalId: { type: String, index: true, sparse: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    workMode: {
      type: String,
      enum: ["Remote", "Hybrid", "Onsite"],
      default: null
    },
    url: { type: String },
    externalUrl: { type: String },
    description: { type: String, default: "" },
    skillsExtracted: [{ type: String }],
    postedAt: { type: Date },
    foundAt: { type: Date },
    hash: { type: String, unique: true, sparse: true, index: true },
    status: {
      type: String,
      enum: ["new", "interested", "applied", "saved", "rejected", "archived"],
      default: "new"
    },
    tags: [{ type: String }],
    country: { type: String },
    remoteSupport: { type: Boolean },
    matches: [{ type: Schema.Types.ObjectId, ref: "Match" }],
    telegramNotifiedAt: { type: Date },
    urlClassification: { type: String },
    autoApplySupported: { type: Boolean }
  },
  { timestamps: true }
);

JobSchema.index({ externalId: 1, source: 1 }, { unique: true, sparse: true });
JobSchema.index({ url: 1 }, { sparse: true });

export const Job = models.Job || model<IJob>("Job", JobSchema);
