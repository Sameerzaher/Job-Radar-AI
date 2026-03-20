/**
 * Daily/weekly digest: new high-match jobs and application status changes, sent via Telegram.
 */

import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";
import { ActivityLog } from "@/models/ActivityLog";
import { getOrCreateDefaultUser } from "./userService";
import { sendTelegramMessage, isTelegramConfigured } from "./telegram";
import { getValidJobUrl } from "@/lib/urlValidation";
import { logActivity } from "./activityLogger";

const LOG_PREFIX = "[JobRadar] Digest:";

/** Score threshold for "high match" in digest (default 70). */
const DEFAULT_DIGEST_SCORE_THRESHOLD = 70;

/** Default window when no previous digest: last 24 hours. */
const DEFAULT_DIGEST_HOURS = 24;

/** Max new high-match jobs to list in digest. */
const MAX_NEW_JOBS = 15;

/** Max applied/failed/needs_review to list each. */
const MAX_STATUS_ITEMS = 10;

function getDigestScoreThreshold(): number {
  const v = process.env.DIGEST_SCORE_THRESHOLD;
  if (v == null || v === "") return DEFAULT_DIGEST_SCORE_THRESHOLD;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : DEFAULT_DIGEST_SCORE_THRESHOLD;
}

function getDigestHours(): number {
  const v = process.env.DIGEST_HOURS;
  if (v == null || v === "") return DEFAULT_DIGEST_HOURS;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DIGEST_HOURS;
}

/**
 * Get the timestamp of the last successfully sent digest (from ActivityLog).
 */
export async function getLastDigestSentAt(): Promise<Date | null> {
  await connectToDatabase();
  const last = await ActivityLog.findOne({ type: "digest", status: "success" })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();
  if (!last || !(last as { createdAt?: Date }).createdAt) return null;
  return new Date((last as { createdAt: Date }).createdAt);
}

/**
 * Compute "since" date: last digest sent at, or now - DIGEST_HOURS.
 */
export async function getDigestSinceDate(): Promise<Date> {
  const last = await getLastDigestSentAt();
  if (last) return last;
  const hours = getDigestHours();
  const since = new Date();
  since.setHours(since.getHours() - hours);
  return since;
}

export interface DigestData {
  since: Date;
  newHighMatch: Array<{ title: string; company: string; location: string; score: number; url: string | null }>;
  applied: Array<{ title: string; company: string }>;
  failed: Array<{ title: string; company: string }>;
  needsReview: Array<{ title: string; company: string }>;
}

/**
 * Load digest data for the default user since the given date.
 */
export async function loadDigestData(since: Date): Promise<DigestData> {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();
  const threshold = getDigestScoreThreshold();

  const [newHighMatchDocs, appliedDocs, failedDocs, needsReviewDocs] = await Promise.all([
    Match.find({
      user: user._id,
      createdAt: { $gte: since },
      score: { $gte: threshold }
    })
      .sort({ createdAt: -1 })
      .limit(MAX_NEW_JOBS)
      .populate<{ job: { title: string; company: string; location: string; url?: string; externalUrl?: string } }>("job")
      .lean(),
    Match.find({
      user: user._id,
      applicationStatus: "applied",
      $or: [{ appliedAt: { $gte: since } }, { updatedAt: { $gte: since } }]
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_STATUS_ITEMS)
      .populate<{ job: { title: string; company: string } }>("job")
      .lean(),
    Match.find({
      user: user._id,
      applicationStatus: "failed",
      updatedAt: { $gte: since }
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_STATUS_ITEMS)
      .populate<{ job: { title: string; company: string } }>("job")
      .lean(),
    Match.find({
      user: user._id,
      applicationStatus: "needs_review",
      updatedAt: { $gte: since }
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_STATUS_ITEMS)
      .populate<{ job: { title: string; company: string } }>("job")
      .lean()
  ]);

  const newHighMatch: DigestData["newHighMatch"] = newHighMatchDocs
    .filter((m) => (m as { job?: unknown }).job)
    .map((m) => {
      const job = (m as { job: { title: string; company: string; location: string; url?: string; externalUrl?: string }; score: number }).job;
      const url = getValidJobUrl(job);
      return {
        title: job.title,
        company: job.company,
        location: job.location,
        score: (m as { score: number }).score,
        url
      };
    });

  const toTitleCompany = (
    docs: Array<{ job?: { title: string; company: string } }>
  ): Array<{ title: string; company: string }> =>
    docs
      .filter((m) => (m as { job?: unknown }).job)
      .map((m) => {
        const job = (m as { job: { title: string; company: string } }).job;
        return { title: job.title, company: job.company };
      });

  return {
    since,
    newHighMatch,
    applied: toTitleCompany(appliedDocs),
    failed: toTitleCompany(failedDocs),
    needsReview: toTitleCompany(needsReviewDocs)
  };
}

/**
 * Build a single Telegram-friendly digest message (plain text, under 4096 chars).
 */
export function formatDigestMessage(data: DigestData): string {
  const lines: string[] = [];
  const sinceStr = data.since.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short"
  });

  lines.push("📬 Job Radar – Digest");
  lines.push(`Since: ${sinceStr}`);
  lines.push("");

  if (data.newHighMatch.length > 0) {
    lines.push("🆕 New high-match jobs");
    for (let i = 0; i < data.newHighMatch.length; i++) {
      const j = data.newHighMatch[i];
      const link = j.url ? ` ${j.url}` : "";
      lines.push(`${i + 1}. ${j.title} @ ${j.company} (${j.score})${link}`);
    }
    lines.push("");
  }

  if (data.applied.length > 0) {
    lines.push("✅ Applied");
    data.applied.forEach((a, i) => lines.push(`${i + 1}. ${a.title} – ${a.company}`));
    lines.push("");
  }

  if (data.failed.length > 0) {
    lines.push("❌ Failed");
    data.failed.forEach((a, i) => lines.push(`${i + 1}. ${a.title} – ${a.company}`));
    lines.push("");
  }

  if (data.needsReview.length > 0) {
    lines.push("👀 Needs review");
    data.needsReview.forEach((a, i) => lines.push(`${i + 1}. ${a.title} – ${a.company}`));
    lines.push("");
  }

  if (
    data.newHighMatch.length === 0 &&
    data.applied.length === 0 &&
    data.failed.length === 0 &&
    data.needsReview.length === 0
  ) {
    lines.push("No new high-match jobs or status changes in this period.");
  }

  const text = lines.join("\n");
  return text.length > 4000 ? text.slice(0, 3997) + "…" : text;
}

/**
 * Run digest: get since date, load data, format, send via Telegram, log result.
 * Returns true if sent (or skipped because no Telegram); false on error.
 */
export async function runDigest(): Promise<{ sent: boolean; error?: string }> {
  if (!isTelegramConfigured()) {
    console.log(`${LOG_PREFIX} skipped – Telegram not configured`);
    await logActivity({
      type: "digest",
      status: "skipped",
      message: "Digest skipped – Telegram not configured",
      details: {}
    }).catch(() => {});
    return { sent: false };
  }

  try {
    const since = await getDigestSinceDate();
    const data = await loadDigestData(since);
    const text = formatDigestMessage(data);

    console.log(
      `${LOG_PREFIX} building digest since ${since.toISOString()} | new=${data.newHighMatch.length} applied=${data.applied.length} failed=${data.failed.length} needsReview=${data.needsReview.length}`
    );

    const result = await sendTelegramMessage(text, {
      messageContext: "digest",
      details: {
        since: since.toISOString(),
        newHighMatch: data.newHighMatch.length,
        applied: data.applied.length,
        failed: data.failed.length,
        needsReview: data.needsReview.length
      }
    });

    if (result.success) {
      await logActivity({
        type: "digest",
        status: "success",
        message: "Digest sent",
        details: {
          since: since.toISOString(),
          newHighMatch: data.newHighMatch.length,
          applied: data.applied.length,
          failed: data.failed.length,
          needsReview: data.needsReview.length
        }
      }).catch(() => {});
      return { sent: true };
    }

    await logActivity({
      type: "digest",
      status: "failed",
      message: "Digest send failed",
      details: { error: result.error }
    }).catch(() => {});
    return { sent: false, error: result.error };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} error:`, errMsg);
    await logActivity({
      type: "digest",
      status: "failed",
      message: "Digest error",
      details: { error: errMsg }
    }).catch(() => {});
    return { sent: false, error: errMsg };
  }
}
