import { NextResponse } from "next/server";
import { sendTelegramTestMessage, getTelegramDiagnostics } from "@/services/telegram";

/**
 * GET /api/test/telegram
 * Send a real test message to the configured Telegram chat.
 * Returns detailed JSON: config (token/chatId present), success/error, response body on failure.
 */
export async function GET() {
  const diagnostics = await getTelegramDiagnostics();
  const result = await sendTelegramTestMessage();

  const body = {
    configured: {
      telegramConfigured: diagnostics.telegramConfigured,
      tokenPresent: diagnostics.tokenPresent,
      chatIdPresent: diagnostics.chatIdPresent
    },
    success: result.success,
    ...(result.success
      ? { message: "Test message sent to Telegram." }
      : { error: result.error, responseBody: result.responseBody ?? undefined })
  };

  if (result.success) {
    return NextResponse.json(body);
  }
  return NextResponse.json(body, { status: 400 });
}
