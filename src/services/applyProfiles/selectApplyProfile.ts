/**
 * Select the best apply profile for a job/match.
 * Used by auto-apply and by job details/review to show which profile would be used.
 */

import type { IApplyProfile } from "@/models/ApplyProfile";
import type { IJob } from "@/models/Job";
import type { IMatch } from "@/models/Match";
import type { IUser } from "@/models/User";
import { getActiveApplyProfilesForUser } from "./applyProfileService";

const LOG = "[JobRadar] SelectApplyProfile:";

export interface SelectApplyProfileResult {
  selectedProfile: IApplyProfile | null;
  reasons: string[];
  /** When no profiles exist, fall back to user-level (backward compat). */
  useUserFallback: boolean;
}

type JobLike = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  workMode?: string;
  remoteSupport?: boolean;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function titleContainsRole(title: string, targetRoles: string[]): boolean {
  const t = normalize(title);
  for (const role of targetRoles) {
    if (!role.trim()) continue;
    const r = normalize(role);
    if (t.includes(r)) return true;
    // e.g. "Full Stack" -> "full stack", "fullstack"
    if (t.includes(r.replace(/\s/g, ""))) return true;
  }
  return false;
}

function descriptionContainsKeyword(description: string, keyword: string): boolean {
  const d = normalize(description);
  const k = normalize(keyword);
  if (!k) return false;
  return d.includes(k) || d.includes(k.replace(/\s/g, ""));
}

function titleOrDescriptionContainsExcluded(
  title: string,
  description: string,
  excluded: string[]
): boolean {
  const t = normalize(title);
  const d = normalize(description);
  for (const ex of excluded) {
    const e = normalize(ex);
    if (!e) continue;
    if (t.includes(e) || t.includes(e.replace(/\s/g, ""))) return true;
    if (d.includes(e) || d.includes(e.replace(/\s/g, ""))) return true;
  }
  return false;
}

function jobMatchesSeniority(
  title: string,
  description: string,
  seniorityTargets: string[]
): boolean {
  if (seniorityTargets.length === 0) return true;
  const text = normalize(title + " " + (description ?? ""));
  const junior = text.includes("junior") || text.includes("jr.");
  const mid = text.includes("mid") || text.includes("middle") || text.includes("intermediate");
  const senior = text.includes("senior") || text.includes("sr.") || text.includes("lead") || text.includes("principal");
  for (const s of seniorityTargets) {
    const t = normalize(s);
    if (t.includes("junior") && junior) return true;
    if (t.includes("mid") && mid) return true;
    if (t.includes("senior") && senior) return true;
  }
  return false;
}

function jobMatchesLocation(
  job: JobLike,
  preferredLocations: string[],
  remoteOnly: boolean
): boolean {
  const loc = normalize((job.location ?? "") + " " + (job.description ?? ""));
  const isRemote =
    loc.includes("remote") ||
    job.workMode === "Remote" ||
    job.remoteSupport === true;
  if (remoteOnly) return isRemote;
  if (preferredLocations.length === 0) return true;
  if (isRemote) return true;
  for (const p of preferredLocations) {
    if (!p.trim()) continue;
    if (loc.includes(normalize(p))) return true;
  }
  return true; // no location filter = accept
}

/**
 * Score a single profile against the job (0 = no match, higher = better).
 * Returns { score, reasons }.
 */
function scoreProfile(
  profile: IApplyProfile,
  job: JobLike,
  _match: IMatch
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const title = job.title ?? "";
  const description = job.description ?? "";

  if (profile.targetRoles.length > 0) {
    if (titleContainsRole(title, profile.targetRoles)) {
      score += 40;
      reasons.push(`Title matches target role`);
    }
  } else {
    score += 20;
    reasons.push("No role filter (neutral)");
  }

  let preferredHit = 0;
  for (const kw of profile.preferredKeywords) {
    if (descriptionContainsKeyword(description, kw) || title.toLowerCase().includes(normalize(kw))) {
      preferredHit++;
    }
  }
  if (profile.preferredKeywords.length > 0 && preferredHit > 0) {
    score += Math.min(30, preferredHit * 10);
    reasons.push(`${preferredHit} preferred keyword(s) matched`);
  } else if (profile.preferredKeywords.length === 0) {
    score += 10;
  }

  if (profile.excludedKeywords.length > 0) {
    if (titleOrDescriptionContainsExcluded(title, description, profile.excludedKeywords)) {
      score -= 50;
      reasons.push("Excluded keyword found");
    }
  }

  if (profile.seniorityTargets.length > 0) {
    if (jobMatchesSeniority(title, description, profile.seniorityTargets)) {
      score += 20;
      reasons.push("Seniority match");
    }
  } else {
    score += 5;
  }

  if (jobMatchesLocation(job, profile.preferredLocations, profile.remoteOnly)) {
    score += 15;
    if (profile.remoteOnly && (job.remoteSupport || (job.location ?? "").toLowerCase().includes("remote"))) {
      reasons.push("Remote match");
    } else if (profile.preferredLocations.length > 0) {
      reasons.push("Location match");
    }
  } else {
    score -= 20;
    reasons.push("Location mismatch");
  }

  if (profile.isDefault) {
    score += 5;
    reasons.push("Default profile");
  }

  return { score: Math.max(0, score), reasons };
}

/**
 * Select the best apply profile for this user, job, and match.
 * If the user has no apply profiles, returns null and useUserFallback: true.
 */
export async function selectBestApplyProfile(
  user: IUser,
  job: IJob | JobLike,
  match: IMatch
): Promise<SelectApplyProfileResult> {
  const profiles = await getActiveApplyProfilesForUser(user._id);
  if (profiles.length === 0) {
    console.log(`${LOG} no apply profiles for user – using user-level fallback`);
    return { selectedProfile: null, reasons: ["No apply profiles; using profile-level resume/cover"], useUserFallback: true };
  }

  const jobLike: JobLike = {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    workMode: (job as IJob).workMode,
    remoteSupport: (job as IJob).remoteSupport
  };

  let best: { profile: IApplyProfile; score: number; reasons: string[] } | null = null;
  for (const profile of profiles) {
    const { score, reasons } = scoreProfile(profile, jobLike, match);
    if (score > 0 && (!best || score > best.score)) {
      best = { profile, score, reasons };
    }
  }

  if (!best) {
    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    const reasons = ["No strong match; using default or first profile"];
    console.log(`${LOG} selected profile=${defaultProfile.name} (fallback) reasons=${reasons.join("; ")}`);
    return {
      selectedProfile: defaultProfile,
      reasons,
      useUserFallback: false
    };
  }

  console.log(
    `${LOG} selected profile=${best.profile.name} score=${best.score} reasons=${best.reasons.join("; ")}`
  );
  return {
    selectedProfile: best.profile,
    reasons: best.reasons,
    useUserFallback: false
  };
}
