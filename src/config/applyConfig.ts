/**
 * Environment-based safety and thresholds for auto-apply and review queue.
 */

const parseNum = (v: string | undefined, defaultVal: number, min: number, max: number): number => {
  if (v == null || v === "") return defaultVal;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
};

const parseBool = (v: string | undefined, defaultVal: boolean): boolean => {
  if (v == null || v === "") return defaultVal;
  return v.toLowerCase() === "true" || v === "1";
};

export interface ApplyConfig {
  /** If false, runAutoApply exits without applying. */
  autoApplyEnabled: boolean;
  /** Score >= this => queued for auto-apply. */
  autoApplyScoreThreshold: number;
  /** Score in [reviewScoreMin, autoApplyScoreThreshold) => ready_for_review. */
  reviewScoreMin: number;
  /** Max applications per run. */
  maxApplicationsPerRun: number;
  /** Max applications per day (approximate via ActivityLog). */
  maxApplicationsPerDay: number;
  /** Comma-separated sources that require manual review before apply (e.g. "Workable"). */
  requireReviewForSources: string[];
  /** Default dryRun when not specified in request. */
  dryRunDefault: boolean;
}

let cached: ApplyConfig | null = null;

export function getApplyConfig(): ApplyConfig {
  if (cached) return cached;
  const autoApplyScoreThreshold = parseNum(
    process.env.AUTO_APPLY_SCORE_THRESHOLD,
    90,
    50,
    100
  );
  const reviewScoreMin = parseNum(
    process.env.REVIEW_SCORE_MIN,
    80,
    0,
    autoApplyScoreThreshold - 1
  );
  cached = {
    autoApplyEnabled: parseBool(process.env.AUTO_APPLY_ENABLED, true),
    autoApplyScoreThreshold,
    reviewScoreMin,
    maxApplicationsPerRun: parseNum(
      process.env.MAX_APPLICATIONS_PER_RUN,
      10,
      1,
      50
    ),
    maxApplicationsPerDay: parseNum(
      process.env.MAX_APPLICATIONS_PER_DAY,
      20,
      1,
      200
    ),
    requireReviewForSources: (process.env.REQUIRE_REVIEW_FOR_SOURCES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    dryRunDefault: parseBool(process.env.DRY_RUN_DEFAULT, false)
  };
  return cached;
}

/** Score >= threshold => queued; score in [reviewMin, threshold) => ready_for_review; else new. */
export function getApplicationStatusFromScore(score: number): "queued" | "ready_for_review" | "new" {
  const { autoApplyScoreThreshold, reviewScoreMin } = getApplyConfig();
  if (score >= autoApplyScoreThreshold) return "queued";
  if (score >= reviewScoreMin) return "ready_for_review";
  return "new";
}
