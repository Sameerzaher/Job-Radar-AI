import type { IJob } from "@/models/Job";
import type { IUser } from "@/models/User";
import { getJobKeywords } from "./scoring/keywordExtraction";

/** Points per category (as specified) */
const POINTS = {
  TITLE_MATCH: 25,
  SKILL_MATCH_EACH: 10,
  SKILL_MATCH_CAP: 5, // max skills that count toward points (5 × 10 = 50)
  LOCATION_MATCH: 10,
  REMOTE_MATCH: 10,
  SENIORITY_MATCH: 10
} as const;

/** Penalties */
const PENALTY = {
  SENIOR_BEYOND_LEVEL: 15,
  EXCLUDED_KEYWORD_EACH: 10,
  EXCLUDED_KEYWORD_CAP: 20
} as const;

const SENIORITY_ORDER: Record<string, number> = {
  junior: 1,
  "junior-mid": 2,
  mid: 3,
  senior: 4
};

export interface MatchScore {
  score: number;
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
}

function getUserSeniorityLevel(seniority: string): number {
  return SENIORITY_ORDER[seniority] ?? 2;
}

function jobAsksForSeniorLevel(job: IJob): boolean {
  const title = (job.title ?? "").toLowerCase();
  const desc = (job.description ?? "").toLowerCase();
  const text = `${title} ${desc}`;
  return /senior|lead|principal|staff|architect|head of/i.test(text) && !/junior|mid-level|mid level|entry/i.test(text);
}

function jobText(job: IJob): string {
  const desc = job.description ?? "";
  const title = job.title ?? "";
  const skills = (job.skillsExtracted ?? []).concat(job.tags ?? []);
  return `${title} ${desc} ${skills.join(" ")}`.toLowerCase();
}

export function scoreJobForUser(job: IJob, user: IUser): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  const jobKeywords = getJobKeywords(job);
  const userSkills = (user.skills ?? []).map((s) => s.trim()).filter(Boolean);
  const userSkillsLower = userSkills.map((s) => s.toLowerCase());
  const matchedSkills = userSkills.filter((_, i) =>
    jobKeywords.some((kw) => kw.includes(userSkillsLower[i]) || userSkillsLower[i].includes(kw))
  );
  const missingSkills = jobKeywords.filter(
    (kw) => !userSkillsLower.some((s) => kw.includes(s) || s.includes(kw))
  );
  const missingUnique = [...new Set(missingSkills)].slice(0, 15);

  // --- Title match (25)
  const targetRoles = user.targetRoles ?? [];
  const titleLower = (job.title ?? "").toLowerCase();
  const titleMatch = targetRoles.some((role) => {
    const first = role.toLowerCase().split(" ")[0] ?? "";
    return first && titleLower.includes(first);
  });
  if (titleMatch) {
    score += POINTS.TITLE_MATCH;
    reasons.push(`Title matches target role`);
  }

  // --- Skill match (10 each, cap at 5 skills)
  const skillCount = Math.min(matchedSkills.length, POINTS.SKILL_MATCH_CAP);
  if (skillCount > 0) {
    score += skillCount * POINTS.SKILL_MATCH_EACH;
    reasons.push(`Skill match: ${matchedSkills.slice(0, POINTS.SKILL_MATCH_CAP).join(", ")}`);
  }

  // --- Location match (10)
  const preferredLocations = user.preferredLocations ?? [];
  const locationHit = preferredLocations.some((loc) =>
    (job.location ?? "").toLowerCase().includes(loc.toLowerCase())
  );
  if (locationHit) {
    score += POINTS.LOCATION_MATCH;
    reasons.push(`Preferred location: ${job.location}`);
  }

  // --- Remote match (10)
  const workMode = (job as IJob & { workMode?: string }).workMode;
  const remoteLike =
    workMode === "Remote" ||
    workMode === "Hybrid" ||
    /remote|hybrid/i.test(job.location ?? "") ||
    (Array.isArray(job.tags) && job.tags.some((t) => /remote|hybrid/i.test(t)));
  if (remoteLike && (user.workModes ?? []).includes("Remote")) {
    score += POINTS.REMOTE_MATCH;
    reasons.push("Supports remote work");
  }

  // --- Seniority match (10)
  const userLevel = getUserSeniorityLevel(user.seniority ?? "junior-mid");
  const jobWantsSenior = jobAsksForSeniorLevel(job);
  const jobWantsJuniorOrMid = /junior|mid-level|mid level|entry/i.test((job.title ?? "") + (job.description ?? ""));
  if (jobWantsSenior && userLevel >= 4) {
    score += POINTS.SENIORITY_MATCH;
    reasons.push("Seniority aligned (senior)");
  } else if (jobWantsJuniorOrMid && (userLevel <= 2 || user.seniority === "junior-mid")) {
    score += POINTS.SENIORITY_MATCH;
    reasons.push("Seniority aligned (junior–mid)");
  } else if (!jobWantsSenior && userLevel <= 3) {
    score += POINTS.SENIORITY_MATCH;
    reasons.push("Seniority aligned");
  }

  // --- Penalty: senior role beyond user level
  if (jobWantsSenior && userLevel < 4) {
    score -= PENALTY.SENIOR_BEYOND_LEVEL;
    reasons.push("Job targets senior level (above your level)");
  }

  // --- Penalty: excluded keywords
  const excluded = (user as IUser & { excludedKeywords?: string[] }).excludedKeywords ?? [];
  const text = jobText(job);
  const foundExcluded = excluded.filter(
    (kw) => kw && text.includes(kw.trim().toLowerCase())
  );
  if (foundExcluded.length > 0) {
    const penalty = Math.min(
      foundExcluded.length * PENALTY.EXCLUDED_KEYWORD_EACH,
      PENALTY.EXCLUDED_KEYWORD_CAP
    );
    score -= penalty;
    reasons.push(`Excluded keywords in job: ${foundExcluded.join(", ")}`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    reasons,
    matchedSkills: [...new Set(matchedSkills)],
    missingSkills: missingUnique
  };
}
