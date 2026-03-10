const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHAT_ID);
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
