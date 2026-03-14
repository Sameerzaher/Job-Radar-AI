/**
 * Configurable rule thresholds for auto-apply rules engine.
 * Env: AUTO_APPLY_COMPANY_COOLDOWN_DAYS, AUTO_APPLY_MAX_MISSING_SKILLS, AUTO_APPLY_MAX_JOB_AGE_DAYS.
 */

function parseNum(
  v: string | undefined,
  defaultVal: number,
  min: number,
  max: number
): number {
  if (v == null || v === "") return defaultVal;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

export interface RulesConfig {
  companyCooldownDays: number;
  maxMissingSkills: number;
  maxJobAgeDays: number;
}

let cached: RulesConfig | null = null;

export function getRulesConfig(): RulesConfig {
  if (cached) return cached;
  cached = {
    companyCooldownDays: parseNum(
      process.env.AUTO_APPLY_COMPANY_COOLDOWN_DAYS,
      30,
      1,
      365
    ),
    maxMissingSkills: parseNum(
      process.env.AUTO_APPLY_MAX_MISSING_SKILLS,
      4,
      0,
      50
    ),
    maxJobAgeDays: parseNum(
      process.env.AUTO_APPLY_MAX_JOB_AGE_DAYS,
      7,
      1,
      90
    )
  };
  return cached;
}

/** Unsupported role title substrings (case-insensitive). Senior is not listed here; senior-level jobs are allowed when score >= auto-apply threshold. */
export const UNSUPPORTED_ROLE_SUBSTRINGS = [
  "Frontend only",
  "Designer",
  "QA",
  "Marketing"
] as const;

/** True if job title indicates senior-level role (senior, lead, principal, staff, architect, head of), excluding junior/mid/entry. */
export function isSeniorLevelJob(job: { title?: string | null }): boolean {
  const text = (job.title ?? "").toLowerCase();
  return /senior|lead|principal|staff|architect|head of/i.test(text) && !/junior|mid-level|mid level|entry/i.test(text);
}

/** True if failureReason indicates the match was skipped only due to seniority/senior-level rule (no longer used for blocking). */
export function isSeniorityOnlyFailureReason(reason: string | null | undefined): boolean {
  if (!reason || typeof reason !== "string") return false;
  const r = reason.toLowerCase();
  return (
    r.includes("senior level role") ||
    r.includes("above your level") ||
    (r.includes("below auto-apply threshold") && r.includes("senior"))
  );
}

/** Preferred role titles (for prioritization; not used to block). */
export const PREFERRED_ROLES = ["Full Stack Developer", "Backend Developer"] as const;

/** Allowed location keywords (case-insensitive). If location doesn't match and isn't remote-like, skip. */
export const PREFERRED_LOCATION_KEYWORDS = ["israel", "remote"];
