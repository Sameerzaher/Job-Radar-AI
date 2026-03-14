/**
 * Simulates auto-apply routing (URL classification + rules) for test fixtures or ad-hoc jobs.
 * Does not run handlers; use for verification and debug.
 */

import { getOrCreateDefaultUser } from "@/services/userService";
import { classifyProviderUrl } from "./providerUrlClassifier";
import { evaluateJobForAutoApply, type RuleEvaluationResult } from "@/services/rules/rulesEngine";
import { getValidJobUrl, isValidJobUrl } from "@/lib/urlValidation";
import { isSupportedApplySource } from "./types";
import type { TestFixture } from "./testFixtures";

export type RoutingOutcome =
  | "eligible"
  | "skipped_rules"
  | "skipped_unsupported"
  | "needs_review"
  | "applied";

export interface TestRoutingJobInput {
  source: string;
  title: string;
  company: string;
  location: string;
  url?: string | null;
  externalUrl?: string | null;
  postedAt?: Date | string | null;
  foundAt?: Date | string | null;
  missingSkills?: string[];
  appliedCompanyNames?: string[]; // for cooldown simulation
}

export interface TestRoutingResultItem {
  scenarioName?: string;
  provider: string | null;
  hostname: string | null;
  urlClassification: string;
  rulesResult: RuleEvaluationResult;
  finalApplicationStatus: RoutingOutcome;
  reasons: string[];
}

export interface TestRoutingSummary {
  eligible: number;
  skipped_rules: number;
  skipped_unsupported: number;
  needs_review: number;
  applied: number;
}

export interface TestRoutingResponse {
  items: TestRoutingResultItem[];
  summary: TestRoutingSummary;
}

function normalizeDate(d: Date | string | null | undefined): Date | null {
  if (d == null) return null;
  const t = typeof d === "string" ? new Date(d) : d;
  return Number.isFinite(t.getTime()) ? t : null;
}

/**
 * Run routing simulation for one job (URL + rules). Does not call apply handlers.
 */
export async function runTestRoutingForJob(
  jobInput: TestRoutingJobInput,
  scenarioName?: string
): Promise<TestRoutingResultItem> {
  const user = await getOrCreateDefaultUser();
  const url = (jobInput.url ?? jobInput.externalUrl ?? "").trim() || null;
  const reasons: string[] = [];

  // 1) Source supported?
  if (!isSupportedApplySource(jobInput.source)) {
    return {
      scenarioName,
      provider: jobInput.source || null,
      hostname: url ? (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      })() : null,
      urlClassification: "unknown_provider",
      rulesResult: { eligible: false, status: "skipped_rules", reasons: [] },
      finalApplicationStatus: "skipped_unsupported",
      reasons: ["Unsupported source"]
    };
  }

  // 2) URL valid?
  const validUrl = url && isValidJobUrl(url) ? url : null;
  if (!validUrl) {
    const classification = classifyProviderUrl(jobInput.source, url ?? undefined);
    return {
      scenarioName,
      provider: classification.provider,
      hostname: classification.hostname,
      urlClassification: classification.classification,
      rulesResult: { eligible: false, status: "skipped_rules", reasons: [] },
      finalApplicationStatus: "skipped_unsupported",
      reasons: ["Invalid or missing URL"]
    };
  }

  // 3) URL classification
  const urlClassification = classifyProviderUrl(jobInput.source, validUrl);
  if (urlClassification.classification !== "supported_apply_url") {
    const reason =
      urlClassification.classification === "unsupported_custom_careers_page"
        ? "Unsupported careers page URL for auto-apply"
        : urlClassification.classification === "invalid_url"
          ? "Invalid or missing URL"
          : "Unsupported careers page URL for auto-apply";
    return {
      scenarioName,
      provider: urlClassification.provider,
      hostname: urlClassification.hostname,
      urlClassification: urlClassification.classification,
      rulesResult: { eligible: false, status: "skipped_rules", reasons: [] },
      finalApplicationStatus: "skipped_unsupported",
      reasons: [reason]
    };
  }

  // 4) Rules
  const jobForRules = {
    _id: null,
    company: jobInput.company,
    title: jobInput.title,
    location: jobInput.location,
    postedAt: normalizeDate(jobInput.postedAt),
    foundAt: normalizeDate(jobInput.foundAt)
  };
  const matchForRules = { missingSkills: jobInput.missingSkills };
  const simulationContext = jobInput.appliedCompanyNames?.length
    ? { appliedCompanyNames: jobInput.appliedCompanyNames }
    : undefined;
  const rulesResult = await evaluateJobForAutoApply(
    user,
    jobForRules,
    matchForRules,
    simulationContext
  );

  if (!rulesResult.eligible) {
    return {
      scenarioName,
      provider: urlClassification.provider,
      hostname: urlClassification.hostname,
      urlClassification: urlClassification.classification,
      rulesResult,
      finalApplicationStatus: "skipped_rules",
      reasons: rulesResult.reasons
    };
  }

  return {
    scenarioName,
    provider: urlClassification.provider,
    hostname: urlClassification.hostname,
    urlClassification: urlClassification.classification,
    rulesResult,
    finalApplicationStatus: "eligible",
    reasons: []
  };
}

/**
 * Run routing for fixtures or ad-hoc jobs. Returns per-job results and summary counts.
 */
export async function runTestRouting(
  jobs: Array<{ scenarioName?: string; job: TestRoutingJobInput }>
): Promise<TestRoutingResponse> {
  const items: TestRoutingResultItem[] = [];
  const summary: TestRoutingSummary = {
    eligible: 0,
    skipped_rules: 0,
    skipped_unsupported: 0,
    needs_review: 0,
    applied: 0
  };

  for (const { scenarioName, job } of jobs) {
    const item = await runTestRoutingForJob(job, scenarioName);
    items.push(item);
    summary[item.finalApplicationStatus] += 1;
  }

  return { items, summary };
}

/**
 * Convert a test fixture to job input for runTestRouting.
 */
export function fixtureToJobInput(
  fixture: TestFixture
): { scenarioName: string; job: TestRoutingJobInput } {
  const j = fixture.job;
  return {
    scenarioName: fixture.name,
    job: {
      source: j.source,
      title: j.title,
      company: j.company,
      location: j.location,
      url: j.url ?? (j as { externalUrl?: string }).externalUrl ?? null,
      postedAt: j.postedAt ?? null,
      foundAt: j.foundAt ?? null,
      missingSkills: fixture.match.missingSkills,
      appliedCompanyNames: fixture.simulation?.appliedCompanyNames
    }
  };
}
