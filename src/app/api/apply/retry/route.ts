import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/services/userService";
import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";
import { logActivity } from "@/services/activityLogger";

/**
 * POST /api/apply/retry
 * Move all failed and needs_review matches for the default user to queued (so next auto-apply run will retry them).
 */
export async function POST() {
  try {
    await connectToDatabase();
    const user = await getOrCreateDefaultUser();
    const res = await Match.updateMany(
      {
        user: user._id,
        applicationStatus: { $in: ["failed", "needs_review"] }
      },
      { $set: { applicationStatus: "queued", failureReason: null } }
    );
    await logActivity({
      type: "review",
      status: "success",
      message: "Retry all failed",
      details: { modifiedCount: res.modifiedCount }
    });
    return NextResponse.json({ ok: true, queued: res.modifiedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
