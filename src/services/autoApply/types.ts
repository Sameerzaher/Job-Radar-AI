import type { ApplicationMethod } from "@/models/Match";
import type { IJob } from "@/models/Job";
import type { IMatch } from "@/models/Match";
import type { IUser } from "@/models/User";

export const SUPPORTED_APPLY_SOURCES = ["Greenhouse", "Lever", "Workable"] as const;
export type SupportedApplySource = (typeof SUPPORTED_APPLY_SOURCES)[number];

export function isSupportedApplySource(source: string): source is SupportedApplySource {
  return SUPPORTED_APPLY_SOURCES.includes(source as SupportedApplySource);
}

export interface ApplicationProfile {
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeFilePath: string;
  defaultCoverLetter: string;
  /** When set, use this in apply flow instead of defaultCoverLetter (from approved TailoredApplication). */
  tailoredCoverLetter?: string;
  /** Short recruiter message (e.g. for InMail); use where relevant in apply flow. */
  tailoredRecruiterMessage?: string;
}

/** Cover letter to send: tailored if available, otherwise default. */
export function getEffectiveCoverLetter(profile: ApplicationProfile): string {
  return (profile.tailoredCoverLetter ?? profile.defaultCoverLetter) ?? "";
}

export function userToApplicationProfile(user: IUser): ApplicationProfile {
  return {
    fullName: user.name ?? "",
    email: user.email ?? "",
    phone: (user as IUser & { phone?: string }).phone ?? "",
    linkedinUrl: (user as IUser & { linkedinUrl?: string }).linkedinUrl ?? "",
    githubUrl: (user as IUser & { githubUrl?: string }).githubUrl ?? "",
    portfolioUrl: (user as IUser & { portfolioUrl?: string }).portfolioUrl ?? "",
    resumeFilePath: (user as IUser & { resumeFilePath?: string }).resumeFilePath ?? "",
    defaultCoverLetter: (user as IUser & { defaultCoverLetter?: string }).defaultCoverLetter ?? ""
  };
}

export interface ApplyResult {
  success: boolean;
  needsReview?: boolean;
  failureReason?: string | null;
}

export interface ApplyAttemptContext {
  job: IJob;
  match: IMatch;
  user: IUser;
  profile: ApplicationProfile;
  method: ApplicationMethod;
}

export interface AutoApplyOptions {
  dryRun?: boolean;
  maxApplications?: number;
  verbose?: boolean;
}

export interface AutoApplyResult {
  queued: number;
  applied: number;
  failed: number;
  needsReview: number;
  skipped: number;
  results: Array<{
    jobId: string;
    title: string;
    company: string;
    source: string;
    status: "applied" | "failed" | "needs_review" | "skipped";
    failureReason?: string | null;
    /** True when this application used tailored cover letter. */
    tailoredUsed?: boolean;
  }>;
}
