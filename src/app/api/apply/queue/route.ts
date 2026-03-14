import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/services/userService";
import { connectToDatabase } from "@/lib/db";
import { Match } from "@/models/Match";

/**
 * POST /api/apply/queue
 * Queue a single match for auto-apply (sets applicationStatus = "queued", queuedAt = now).
 * Safety: only when job.autoApplySupported === true and job.urlClassification === "supported_apply_url".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const matchId = typeof body.matchId === "string" ? body.matchId.trim() : null;
    if (!matchId) {
      return NextResponse.json({ ok: false, error: "matchId required" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await getOrCreateDefaultUser();

    const match = await Match.findOne({ _id: matchId, user: user._id }).populate("job").lean();
    if (!match) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }

    const job = match.job as unknown as { autoApplySupported?: boolean; urlClassification?: string };
    if (!job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    if (job.autoApplySupported !== true) {
      return NextResponse.json(
        { ok: false, error: "This job cannot be auto-applied (unsupported URL)" },
        { status: 400 }
      );
    }
    if (job.urlClassification !== "supported_apply_url") {
      return NextResponse.json(
        { ok: false, error: "This job cannot be auto-applied (unsupported URL)" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await Match.findOneAndUpdate(
      { _id: matchId, user: user._id },
      { $set: { applicationStatus: "queued", queuedAt: now, failureReason: null } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      match: {
        _id: updated._id,
        applicationStatus: updated.applicationStatus,
        queuedAt: (updated as { queuedAt?: Date }).queuedAt ?? now
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
