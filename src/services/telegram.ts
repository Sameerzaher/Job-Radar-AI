/**
 * Telegram notifications: single send utility, validation, logging, ActivityLog.
 * Required env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
 */

import { logActivity } from "./activityLogger";

const LOG_PREFIX = "[JobRadar] Telegram:";

function getEnvConfig(): { token: string | undefined; chatId: string | undefined } {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return { token, chatId };
}

export function isTelegramConfigured(): boolean {
  const { token, chatId } = getEnvConfig();
  return Boolean(token && chatId);
}

export interface SendTelegramResult {
  success: boolean;
  error?: string;
  responseBody?: string;
}

export interface SendTelegramOptions {
  /** Context for ActivityLog and logs (e.g. "application success"). */
  messageContext?: string;
  /** Extra details for ActivityLog (e.g. jobId, matchId). */
  details?: Record<string, unknown>;
}

/**
 * Single reusable utility: validate env, call Telegram sendMessage API, log and optionally write ActivityLog.
 * Does not throw; returns structured result.
 */
export async function sendTelegramMessage(
  message: string,
  options?: SendTelegramOptions
): Promise<SendTelegramResult> {
  const { token, chatId } = getEnvConfig();
  const ctx = options?.messageContext ?? "send";
  const details = options?.details ?? {};

  if (!token || !chatId) {
    const missing = [(!token && "TELEGRAM_BOT_TOKEN"), (!chatId && "TELEGRAM_CHAT_ID")].filter(Boolean);
    console.warn(`${LOG_PREFIX} send skipped – not configured (missing: ${missing.join(", ")})`);
    const result: SendTelegramResult = {
      success: false,
      error: `Telegram not configured. Set ${missing.join(" and ")} in .env`
    };
    await logActivity({
      type: "telegram",
      status: "failed",
      message: `Telegram ${ctx} skipped`,
      details: { ...details, reason: result.error }
    }).catch(() => {});
    return result;
  }

  console.log(`${LOG_PREFIX} send started (${ctx})`);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true
      })
    });

    const responseBody = await res.text();

    if (!res.ok) {
      console.error(`${LOG_PREFIX} send failed – status ${res.status}, body: ${responseBody}`);
      const result: SendTelegramResult = { success: false, error: `API ${res.status}`, responseBody };
      await logActivity({
        type: "telegram",
        status: "failed",
        message: `Telegram ${ctx} failed`,
        details: { ...details, status: res.status, responseBody: responseBody.slice(0, 500) }
      }).catch(() => {});
      return result;
    }

    console.log(`${LOG_PREFIX} send success (${ctx})`);
    await logActivity({
      type: "telegram",
      status: "success",
      message: `Telegram ${ctx} sent`,
      details: { ...details }
    }).catch(() => {});
    return { success: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} send failed – ${errMsg}`);
    const result: SendTelegramResult = { success: false, error: errMsg };
    await logActivity({
      type: "telegram",
      status: "failed",
      message: `Telegram ${ctx} error`,
      details: { ...details, error: errMsg }
    }).catch(() => {});
    return result;
  }
}

const TEST_MESSAGE = "✅ Job Radar AI Telegram test message.";

/**
 * Send a test message. Used by GET /api/test/telegram.
 */
export async function sendTelegramTestMessage(): Promise<SendTelegramResult> {
  return sendTelegramMessage(TEST_MESSAGE, { messageContext: "test" });
}

export interface HighMatchMessagePayload {
  title: string;
  company: string;
  location: string;
  score: number;
  topMatchingSkills: string[];
  jobLink: string;
}

function formatHighMatchMessage(payload: HighMatchMessagePayload): string {
  const skills =
    payload.topMatchingSkills.length > 0
      ? payload.topMatchingSkills.join(", ")
      : "—";
  return [
    "New high match job found:",
    "",
    `Title: ${payload.title}`,
    `Company: ${payload.company}`,
    `Location: ${payload.location}`,
    `Score: ${payload.score}`,
    `Top matching skills: ${skills}`,
    "",
    `Job link: ${payload.jobLink}`
  ].join("\n");
}

/**
 * Send high-match job notification. No-op if not configured; never throws.
 */
export async function sendHighMatchNotification(
  payload: HighMatchMessagePayload
): Promise<boolean> {
  const text = formatHighMatchMessage(payload);
  const result = await sendTelegramMessage(text, {
    messageContext: "high-match",
    details: { title: payload.title, company: payload.company, score: payload.score }
  });
  return result.success;
}

export interface ApplicationSuccessPayload {
  title: string;
  company: string;
  source: string;
  timestamp: string;
}

function formatApplicationSuccessMessage(payload: ApplicationSuccessPayload): string {
  return [
    "✅ Applied successfully",
    `Role: ${payload.title}`,
    `Company: ${payload.company}`,
    `Source: ${payload.source}`,
    `Time: ${payload.timestamp}`
  ].join("\n");
}

/**
 * Send single application success notification. Only call after applicationStatus = applied.
 * Never throws.
 */
export async function sendApplicationSuccess(
  payload: ApplicationSuccessPayload
): Promise<boolean> {
  const text = formatApplicationSuccessMessage(payload);
  const result = await sendTelegramMessage(text, {
    messageContext: "application success",
    details: { title: payload.title, company: payload.company, source: payload.source }
  });
  return result.success;
}

export interface BatchApplicationSummaryPayload {
  total: number;
  items: Array<{ title: string; company: string }>;
  /** If provided, include in the message. */
  attempted?: number;
  applied?: number;
  failed?: number;
  needsReview?: number;
}

function formatBatchApplicationSummary(payload: BatchApplicationSummaryPayload): string {
  const lines: string[] = [];
  if (
    payload.attempted != null &&
    payload.applied != null &&
    (payload.failed != null || payload.needsReview != null)
  ) {
    lines.push(
      `📋 Auto-apply run: ${payload.attempted} attempted, ${payload.applied} applied, ${payload.failed ?? 0} failed, ${payload.needsReview ?? 0} needs review`
    );
    lines.push("");
  }
  lines.push(`✅ Applied to ${payload.total} job${payload.total === 1 ? "" : "s"}`);
  for (let i = 0; i < payload.items.length; i++) {
    const item = payload.items[i];
    lines.push(`${i + 1}. ${item.title} - ${item.company}`);
  }
  return lines.join("\n");
}

/**
 * Send batch application summary. Never throws.
 */
export async function sendBatchApplicationSummary(
  payload: BatchApplicationSummaryPayload
): Promise<boolean> {
  if (payload.total === 0 && (payload.attempted ?? 0) === 0) return true;
  const text = formatBatchApplicationSummary(payload);
  const result = await sendTelegramMessage(text, {
    messageContext: "batch apply summary",
    details: {
      total: payload.total,
      attempted: payload.attempted,
      applied: payload.applied,
      failed: payload.failed,
      needsReview: payload.needsReview
    }
  });
  return result.success;
}

export interface TelegramDiagnostics {
  telegramConfigured: boolean;
  tokenPresent: boolean;
  chatIdPresent: boolean;
  lastTelegramSuccessAt: Date | null;
  lastTelegramFailureAt: Date | null;
  lastTelegramError: string | null;
}

/**
 * Get Telegram config and last success/failure from ActivityLog.
 */
export async function getTelegramDiagnostics(): Promise<TelegramDiagnostics> {
  const { token, chatId } = getEnvConfig();
  const tokenPresent = Boolean(token);
  const chatIdPresent = Boolean(chatId);
  const telegramConfigured = tokenPresent && chatIdPresent;

  let lastTelegramSuccessAt: Date | null = null;
  let lastTelegramFailureAt: Date | null = null;
  let lastTelegramError: string | null = null;

  try {
    const { connectToDatabase } = await import("@/lib/db");
    const { ActivityLog } = await import("@/models/ActivityLog");
    await connectToDatabase();

    const [lastSuccess, lastFailed] = await Promise.all([
      ActivityLog.findOne({ type: "telegram", status: "success" })
        .sort({ createdAt: -1 })
        .lean(),
      ActivityLog.findOne({ type: "telegram", status: "failed" })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    if (lastSuccess && (lastSuccess as { createdAt: Date }).createdAt) {
      lastTelegramSuccessAt = new Date((lastSuccess as { createdAt: Date }).createdAt);
    }
    if (lastFailed && (lastFailed as { createdAt: Date }).createdAt) {
      lastTelegramFailureAt = new Date((lastFailed as { createdAt: Date }).createdAt);
      const d = lastFailed as { details?: { error?: string; responseBody?: string; reason?: string } };
      lastTelegramError =
        d.details?.error ?? d.details?.reason ?? (d.details?.responseBody ? String(d.details.responseBody).slice(0, 200) : "Unknown");
    }
  } catch (_) {
    // ignore
  }

  return {
    telegramConfigured,
    tokenPresent,
    chatIdPresent,
    lastTelegramSuccessAt,
    lastTelegramFailureAt,
    lastTelegramError
  };
}
