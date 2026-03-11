/**
 * Environment-based config for resume tailoring and cover letter generation.
 */

const parseNum = (
  v: string | undefined,
  defaultVal: number,
  min: number,
  max: number
): number => {
  if (v == null || v === "") return defaultVal;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
};

const parseBool = (v: string | undefined, defaultVal: boolean): boolean => {
  if (v == null || v === "") return defaultVal;
  return v.toLowerCase() === "true" || v === "1";
};

export interface TailoringConfig {
  /** If false, tailoring generation is disabled. */
  tailoringEnabled: boolean;
  /** Auto-generate tailoring when match score >= this (0-100). */
  tailoringScoreThreshold: number;
  /** When true, live auto-apply may require tailored content for supported sources. */
  requireTailoringBeforeApply: boolean;
  /** Default OpenAI model for tailoring (e.g. gpt-4o-mini). */
  defaultAiModel: string;
}

let cached: TailoringConfig | null = null;

export function getTailoringConfig(): TailoringConfig {
  if (cached) return cached;
  cached = {
    tailoringEnabled: parseBool(process.env.TAILORING_ENABLED, true),
    tailoringScoreThreshold: parseNum(
      process.env.TAILORING_SCORE_THRESHOLD,
      75,
      0,
      100
    ),
    requireTailoringBeforeApply: parseBool(
      process.env.REQUIRE_TAILORING_BEFORE_APPLY,
      false
    ),
    defaultAiModel:
      process.env.DEFAULT_AI_MODEL?.trim() || "gpt-4o-mini"
  };
  return cached;
}

/** Minimum job description length (chars) to attempt tailoring; shorter => skip and log. */
export const MIN_JOB_DESCRIPTION_LENGTH = 200;
