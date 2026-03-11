const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

const TEST_MESSAGE = "✅ Job Radar AI Telegram test message.";

/**
 * Send a test message to the configured Telegram chat.
 * @returns { success: true } or { success: false, error: string }
 */
export async function sendTelegramTestMessage(): Promise<
  { success: true } | { success: false; error: string }
> {
  if (!BOT_TOKEN || !CHAT_ID) {
    return {
      success: false,
      error: "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env"
    };
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: TEST_MESSAGE,
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      const err = await res.text();
      return {
        success: false,
        error: `Telegram API error (${res.status}): ${err}`
      };
    }
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

export interface HighMatchMessagePayload {
  title: string;
  company: string;
  location: string;
  score: number;
  topMatchingSkills: string[];
  jobLink: string;
}

function formatMessage(payload: HighMatchMessagePayload): string {
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
 * Send a high-match job notification to Telegram. No-op if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.
 * @returns true if sent, false if skipped (not configured or API error)
 */
export async function sendHighMatchNotification(
  payload: HighMatchMessagePayload
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;

  const text = formatMessage(payload);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[JobRadar] Telegram send failed:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[JobRadar] Telegram error:", e);
    return false;
  }
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
 * Send a single application success notification to Telegram.
 */
export async function sendApplicationSuccess(
  payload: ApplicationSuccessPayload
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;
  const text = formatApplicationSuccessMessage(payload);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      console.error("[JobRadar] Telegram application success send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[JobRadar] Telegram error:", e);
    return false;
  }
}

export interface BatchApplicationSummaryPayload {
  total: number;
  items: Array<{ title: string; company: string }>;
}

function formatBatchApplicationSummary(payload: BatchApplicationSummaryPayload): string {
  const lines = [
    `✅ Applied to ${payload.total} job${payload.total === 1 ? "" : "s"}`,
    ...payload.items.map((item, i) => `${i + 1}. ${item.title} - ${item.company}`)
  ];
  return lines.join("\n");
}

/**
 * Send a batch application summary to Telegram.
 */
export async function sendBatchApplicationSummary(
  payload: BatchApplicationSummaryPayload
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;
  if (payload.total === 0) return true;
  const text = formatBatchApplicationSummary(payload);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      console.error("[JobRadar] Telegram batch summary send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[JobRadar] Telegram error:", e);
    return false;
  }
}
