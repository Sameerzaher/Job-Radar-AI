import { NextResponse } from "next/server";
import { sendTelegramTestMessage } from "@/services/telegram";

/**
 * GET /api/test/telegram
 * Send a test message to the configured Telegram bot (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
 * Returns success or error in the response.
 */
export async function GET() {
  const result = await sendTelegramTestMessage();
  if (result.success) {
    return NextResponse.json({ success: true, message: "Test message sent to Telegram." });
  }
  return NextResponse.json(
    { success: false, error: result.error },
    { status: 400 }
  );
}
