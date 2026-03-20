/**
 * Company Memory: track application history per company for cooldowns, analytics, and UI.
 */

import { connectToDatabase } from "@/lib/db";
import { CompanyMemory, type ICompanyMemory, type CompanyMemoryOutcome } from "@/models/CompanyMemory";
import { normalizeCompanyName, displayCompanyName } from "@/lib/companyNormalization";
import mongoose from "mongoose";

const LOG = "[JobRadar] CompanyMemory:";

export type RecordOutcomeParams = {
  userId: string | { _id: unknown };
  companyName: string;
  jobTitle: string;
  outcome: CompanyMemoryOutcome;
  applyProfileId?: string | null;
  applyProfileName?: string | null;
  appliedAt?: Date | null;
};

/**
 * Record an application outcome for a company. Creates or updates CompanyMemory.
 * Call when Match applicationStatus is set to applied, failed, needs_review, rejected, skipped_rules, skipped_unsupported.
 */
export async function recordApplicationOutcome(params: RecordOutcomeParams): Promise<void> {
  await connectToDatabase();
  const userId = typeof params.userId === "string" ? params.userId : String(params.userId._id);
  const normalized = normalizeCompanyName(params.companyName);
  const display = displayCompanyName(params.companyName);
  if (!normalized) return;

  const now = new Date();
  const appliedAt = params.outcome === "applied" ? (params.appliedAt ?? now) : undefined;

  const doc = await CompanyMemory.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), normalizedCompanyName: normalized },
    {
      $set: {
        displayCompanyName: display,
        lastAppliedRole: params.jobTitle?.trim() ?? "",
        lastApplyProfileId: params.applyProfileId
          ? new mongoose.Types.ObjectId(params.applyProfileId)
          : null,
        lastApplyProfileName: (params.applyProfileName ?? "").trim(),
        lastOutcome: params.outcome,
        ...(appliedAt && { lastAppliedAt: appliedAt }),
        updatedAt: now
      },
      $inc: {
        totalApplications: 1,
        ...(params.outcome === "applied" && { totalApplied: 1 }),
        ...(params.outcome === "failed" && { totalFailed: 1 }),
        ...(params.outcome === "needs_review" && { totalNeedsReview: 1 }),
        ...(params.outcome === "rejected" && { totalRejected: 1 }),
        ...(params.outcome === "skipped_rules" && { totalSkippedRules: 1 }),
        ...(params.outcome === "skipped_unsupported" && { totalSkippedUnsupported: 1 })
      }
    },
    { upsert: true, new: true }
  ).lean();

  if (doc) {
    console.log(
      `${LOG} updated company=${display} outcome=${params.outcome} totalApplications=${(doc as unknown as ICompanyMemory).totalApplications}`
    );
  }
}

/**
 * Get company memory for a user and company (by display name); returns null if none.
 */
export async function getCompanyMemoryByUserAndCompany(
  userId: string | { _id: unknown },
  companyName: string
): Promise<ICompanyMemory | null> {
  await connectToDatabase();
  const uid = typeof userId === "string" ? userId : String(userId._id);
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return null;
  const doc = await CompanyMemory.findOne({ userId: uid, normalizedCompanyName: normalized }).lean();
  return doc as unknown as ICompanyMemory | null;
}

/**
 * List all company memories for a user (for operations/analytics).
 */
export async function listCompanyMemoriesByUser(
  userId: string | { _id: unknown }
): Promise<ICompanyMemory[]> {
  await connectToDatabase();
  const uid = typeof userId === "string" ? userId : String(userId._id);
  const list = await CompanyMemory.find({ userId: uid })
    .sort({ lastAppliedAt: -1, totalApplications: -1 })
    .lean();
  return list as unknown as ICompanyMemory[];
}

/**
 * Check if a company is within cooldown (had an "applied" outcome within cooldownDays).
 */
export async function isCompanyOnCooldown(
  userId: string | { _id: unknown },
  companyName: string,
  cooldownDays: number
): Promise<boolean> {
  const mem = await getCompanyMemoryByUserAndCompany(userId, companyName);
  if (!mem?.lastAppliedAt) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);
  return new Date(mem.lastAppliedAt) >= cutoff;
}

/**
 * Get normalized company names that are currently on cooldown (for rules engine).
 */
export async function getCompaniesOnCooldownForUser(
  userId: string | { _id: unknown },
  cooldownDays: number
): Promise<Set<string>> {
  await connectToDatabase();
  const uid = typeof userId === "string" ? userId : String(userId._id);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);
  const docs = await CompanyMemory.find({
    userId: uid,
    lastAppliedAt: { $gte: cutoff }
  })
    .select("normalizedCompanyName")
    .lean();
  return new Set((docs as { normalizedCompanyName: string }[]).map((d) => d.normalizedCompanyName));
}
