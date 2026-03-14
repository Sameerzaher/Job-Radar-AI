/**
 * Rules engine: evaluate whether a job is eligible for auto-apply.
 * Runs before a job is added to the apply queue; blocks set applicationStatus = skipped_rules.
 */

import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";
import { getRulesConfig, UNSUPPORTED_ROLE_SUBSTRINGS, PREFERRED_LOCATION_KEYWORDS } from "./rulesConfig";

const LOG_PREFIX = "[JobRadar] Rules:";

export type RuleEligibilityStatus = "eligible" | "skipped_rules" | "ready_for_review";

export interface RuleEvaluationResult {
  eligible: boolean;
  status: RuleEligibilityStatus;
  reasons: string[];
}

export type JobForRules = {
  _id: unknown;
  company: string;
  title: string;
  location: string;
  postedAt?: Date | null;
  foundAt?: Date | null;
};

export type MatchForRules = {
  missingSkills?: string[];
};

export type RulesSimulationContext = {
  /** When set, cooldown check uses this list instead of DB (for testing). */
  appliedCompanyNames?: string[];
};

/**
 * Evaluate a job for auto-apply eligibility. Returns eligible flag and list of block reasons.
 * Called before pushing a job into the apply queue.
 * When simulationContext.appliedCompanyNames is provided, cooldown uses that set instead of DB.
 */
export async function evaluateJobForAutoApply(
  userId: { _id: unknown },
  job: JobForRules,
  match: MatchForRules,
  simulationContext?: RulesSimulationContext
): Promise<RuleEvaluationResult> {
  const reasons: string[] = [];
  const config = getRulesConfig();

  // Company cooldown: applied to same company within N days
  const appliedCompanies = new Set<string>();
  if (simulationContext?.appliedCompanyNames?.length) {
    simulationContext.appliedCompanyNames.forEach((c) =>
      appliedCompanies.add(String(c).trim().toLowerCase())
    );
  } else {
    await connectToDatabase();
    const cooldownCutoff = new Date();
    cooldownCutoff.setDate(cooldownCutoff.getDate() - config.companyCooldownDays);
    const allApplied = await Match.find({
      user: userId._id,
      applicationStatus: "applied",
      appliedAt: { $gte: cooldownCutoff }
    })
      .populate("job")
      .lean();
    for (const m of allApplied) {
      const j = m.job as unknown as { company?: string };
      if (j?.company) appliedCompanies.add(String(j.company).trim().toLowerCase());
    }
  }
  const companyLower = (job.company ?? "").trim().toLowerCase();
  if (companyLower && appliedCompanies.has(companyLower)) {
    reasons.push(`Company cooldown (applied to this company within ${config.companyCooldownDays} days)`);
  }

  // Job age: skip if posting older than N days
  const jobDate = job.postedAt ? new Date(job.postedAt) : job.foundAt ? new Date(job.foundAt) : null;
  if (jobDate) {
    const ageDays = (Date.now() - jobDate.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > config.maxJobAgeDays) {
      reasons.push(`Job posting older than ${config.maxJobAgeDays} days`);
    }
  }

  // Missing skills: skip if too many
  const missingCount = match.missingSkills?.length ?? 0;
  if (missingCount > config.maxMissingSkills) {
    reasons.push(`Too many missing skills (${missingCount} > ${config.maxMissingSkills})`);
  }

  // Unsupported role types: title contains certain substrings
  const titleLower = (job.title ?? "").toLowerCase();
  for (const sub of UNSUPPORTED_ROLE_SUBSTRINGS) {
    if (titleLower.includes(sub.toLowerCase())) {
      reasons.push(`Unsupported role type: "${sub}"`);
      break;
    }
  }

  // Location: allow Israel, Remote; skip if location is outside preferred and not remote-like
  const locationLower = (job.location ?? "").toLowerCase();
  const looksRemote = /remote|anywhere|distributed|work from home/i.test(locationLower);
  const inPreferred = PREFERRED_LOCATION_KEYWORDS.some((kw) =>
    locationLower.includes(kw)
  );
  if (!looksRemote && !inPreferred && locationLower.length > 0) {
    reasons.push("Location outside preferred (Israel, Remote)");
  }

  const eligible = reasons.length === 0;
  const status: RuleEligibilityStatus = eligible ? "eligible" : "skipped_rules";
  return { eligible, status, reasons };
}

/**
 * Log rule decision for a job. Call from apply agent.
 */
export function logRuleDecision(
  jobTitle: string,
  company: string,
  result: RuleEvaluationResult,
  verbose: boolean
): void {
  if (!verbose) return;
  if (result.eligible) {
    console.log(`${LOG_PREFIX} rule passed job: ${jobTitle} @ ${company}`);
  } else {
    console.log(
      `${LOG_PREFIX} rule blocked job: ${jobTitle} @ ${company} – ${result.reasons.join("; ")}`
    );
  }
}
