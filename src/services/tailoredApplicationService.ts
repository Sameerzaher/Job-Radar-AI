import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Job, type IJob } from "@/models/Job";
import { Match, type IMatch } from "@/models/Match";
import { User, type IUser } from "@/models/User";
import {
  TailoredApplication,
  type ITailoredApplication,
  type TailoredApplicationStatus
} from "@/models/TailoredApplication";
import { getTailoringConfig, MIN_JOB_DESCRIPTION_LENGTH } from "@/config/tailoringConfig";
import {
  tailorApplicationWithAI,
  buildTailorInput,
  type TailorApplicationOutput
} from "@/services/ai/tailorApplication";
import { logActivity } from "./activityLogger";
import { selectBestApplyProfile } from "@/services/applyProfiles/selectApplyProfile";
import { getApplyProfileById } from "@/services/applyProfiles/applyProfileService";

export interface TailoredApplicationWithJob extends ITailoredApplication {
  job: IJob;
  match?: IMatch;
}

export async function listTailoredApplicationsForUser(
  userId: string
): Promise<TailoredApplicationWithJob[]> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(userId)) return [];
  const list = await TailoredApplication.find({ user: userId })
    .sort({ updatedAt: -1 })
    .populate<{ job: IJob }>("job")
    .populate<{ match: IMatch }>("match")
    .lean();
  return list as unknown as TailoredApplicationWithJob[];
}

export async function getTailoredApplicationById(
  id: string,
  userId: string
): Promise<TailoredApplicationWithJob | null> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId))
    return null;
  const doc = await TailoredApplication.findOne({ _id: id, user: userId })
    .populate<{ job: IJob }>("job")
    .populate<{ match: IMatch }>("match")
    .lean();
  return doc as unknown as TailoredApplicationWithJob | null;
}

export async function getTailoredApplicationByMatchId(
  matchId: string,
  userId: string
): Promise<ITailoredApplication | null> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId) || !mongoose.Types.ObjectId.isValid(userId))
    return null;
  const doc = await TailoredApplication.findOne({ match: matchId, user: userId }).lean();
  return doc as ITailoredApplication | null;
}

/** True if match has tailored content in generated, approved, or used state (for require-tailoring-before-apply). */
export async function hasTailoredContentForMatch(
  matchId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  await connectToDatabase();
  const count = await TailoredApplication.countDocuments({
    match: matchId,
    user: userId,
    status: { $in: ["generated", "approved", "used"] }
  });
  return count > 0;
}

/** Whether we should auto-generate tailoring for this match/job (score, description length, no existing tailoring). */
export function shouldAutoGenerateTailoring(
  match: { score: number },
  job: { description?: string | null },
  existingTailoredId: string | null
): { ok: boolean; reason?: string } {
  const config = getTailoringConfig();
  if (!config.tailoringEnabled) {
    return { ok: false, reason: "Tailoring is disabled" };
  }
  if (existingTailoredId) {
    return { ok: false, reason: "Tailored content already exists" };
  }
  if (match.score < config.tailoringScoreThreshold) {
    return { ok: false, reason: `Score ${match.score} below threshold ${config.tailoringScoreThreshold}` };
  }
  const desc = (job.description ?? "").trim();
  if (desc.length < MIN_JOB_DESCRIPTION_LENGTH) {
    return { ok: false, reason: `Job description too short (${desc.length} < ${MIN_JOB_DESCRIPTION_LENGTH})` };
  }
  return { ok: true };
}

/** Create or get TailoredApplication for a match; optionally run generation. */
export async function ensureTailoredApplication(
  matchId: string,
  userId: string,
  options: { generateIfMissing?: boolean } = {}
): Promise<{ tailored: ITailoredApplication; generated: boolean }> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(matchId) || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid match or user id");
  }
  const matchPopulated = await Match.findById(matchId).populate<{ job: IJob }>("job").lean();
  if (!matchPopulated || (matchPopulated.user as unknown as mongoose.Types.ObjectId).toString() !== userId) {
    throw new Error("Match not found");
  }
  const job = matchPopulated.job as unknown as IJob;
  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  let tailored = await TailoredApplication.findOne({ match: matchId, user: userId });
  if (tailored) {
    return { tailored: tailored as ITailoredApplication, generated: false };
  }

  const matchDoc = await Match.findById(matchId);
  if (!matchDoc) throw new Error("Match not found");
  tailored = await TailoredApplication.create({
    user: userId,
    job: matchDoc.job,
    match: matchDoc._id,
    status: "draft"
  });

  if (options.generateIfMissing) {
    const { ok, reason } = shouldAutoGenerateTailoring(
      matchPopulated as IMatch,
      job,
      null
    );
    if (!ok) {
      if (reason) {
        console.info("[Tailoring] Skip auto-generate:", reason);
        await logActivity({
          type: "tailoring",
          matchId,
          jobId: (job as IJob & { _id?: unknown })._id?.toString(),
          status: "skipped",
          message: reason,
          details: { tailoredApplicationId: (tailored as ITailoredApplication)._id?.toString() }
        });
      }
      return { tailored: tailored as ITailoredApplication, generated: false };
    }
    const result = await runTailoringGeneration(
      (tailored as ITailoredApplication)._id!.toString(),
      userId
    );
    if (result.tailored) tailored = result.tailored as typeof tailored;
    return { tailored: tailored as ITailoredApplication, generated: result.generated };
  }

  return { tailored: tailored as ITailoredApplication, generated: false };
}

/** Run AI (or fallback) generation and save to TailoredApplication. */
export async function runTailoringGeneration(
  tailoredId: string,
  userId: string
): Promise<{ tailored: ITailoredApplication | null; generated: boolean }> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(tailoredId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return { tailored: null, generated: false };
  }
  const tailored = await TailoredApplication.findOne({ _id: tailoredId, user: userId })
    .populate<{ job: IJob }>("job")
    .populate<{ match: IMatch }>("match");
  if (!tailored) return { tailored: null, generated: false };

  const match = tailored.match as unknown as IMatch;
  const job = tailored.job as unknown as IJob;
  const user = await User.findById(userId).lean();
  if (!user || !match || !job) return { tailored: null, generated: false };

  const config = getTailoringConfig();
  const matchWithOverride = match as IMatch & { selectedApplyProfileId?: unknown; applyProfileId?: unknown };
  let applyProfileForTailor: { resumeText?: string; coverLetterTemplate?: string } | null = null;
  let applyProfileIdToSet: string | null = null;
  let applyProfileNameToSet: string | null = null;
  const overrideId = matchWithOverride.selectedApplyProfileId ?? matchWithOverride.applyProfileId;
  if (overrideId) {
    const profile = await getApplyProfileById(String(overrideId), userId);
    if (profile) {
      applyProfileForTailor = { resumeText: profile.resumeText, coverLetterTemplate: profile.coverLetterTemplate };
      applyProfileIdToSet = String(profile._id);
      applyProfileNameToSet = profile.name;
    }
  }
  if (!applyProfileForTailor) {
    const sel = await selectBestApplyProfile(user as IUser, job, match);
    if (sel.selectedProfile) {
      applyProfileForTailor = { resumeText: sel.selectedProfile.resumeText, coverLetterTemplate: sel.selectedProfile.coverLetterTemplate };
      applyProfileIdToSet = String(sel.selectedProfile._id);
      applyProfileNameToSet = sel.selectedProfile.name;
    }
  }
  const input = buildTailorInput(user as IUser, job, match, applyProfileForTailor);

  let output: TailorApplicationOutput;
  let aiModel: string | undefined;
  try {
    output = await tailorApplicationWithAI(input);
    aiModel = config.defaultAiModel;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    tailored.status = "failed";
    tailored.failureReason = message;
    await tailored.save();
    await logActivity({
      type: "tailoring",
      matchId: (match as IMatch & { _id?: unknown })._id?.toString(),
      jobId: (job as IJob & { _id?: unknown })._id?.toString(),
      status: "failed",
      message: `Tailoring failed: ${message}`,
      details: { tailoredApplicationId: tailoredId }
    });
    return { tailored: tailored as ITailoredApplication, generated: false };
  }

  tailored.resumeSummary = output.resumeSummary;
  tailored.suggestedBulletPoints = output.suggestedBulletPoints;
  tailored.missingSkills = output.missingSkills;
  tailored.strengths = output.strengths;
  tailored.coverLetter = output.coverLetter;
  tailored.recruiterMessage = output.recruiterMessage;
  tailored.aiModel = aiModel;
  tailored.generatedAt = new Date();
  tailored.status = "generated";
  tailored.failureReason = undefined;
  if (applyProfileIdToSet && mongoose.Types.ObjectId.isValid(applyProfileIdToSet)) {
    (tailored as { applyProfileId?: mongoose.Types.ObjectId }).applyProfileId = new mongoose.Types.ObjectId(applyProfileIdToSet);
  }
  if (applyProfileNameToSet) tailored.applyProfileName = applyProfileNameToSet;
  await tailored.save();

  await logActivity({
    type: "tailoring",
    matchId: (match as IMatch & { _id?: unknown })._id?.toString(),
    jobId: (job as IJob & { _id?: unknown })._id?.toString(),
    status: "success",
    message: "Tailoring generated",
    details: { tailoredApplicationId: tailoredId }
  });

  return { tailored: tailored as ITailoredApplication, generated: true };
}

/** Set status to approved. */
export async function approveTailoredApplication(
  tailoredId: string,
  userId: string
): Promise<boolean> {
  await connectToDatabase();
  const res = await TailoredApplication.updateOne(
    { _id: tailoredId, user: userId, status: { $in: ["draft", "generated"] } },
    { $set: { status: "approved" as TailoredApplicationStatus } }
  );
  if (res.modifiedCount) {
    const t = await TailoredApplication.findById(tailoredId).lean();
    if (t?.match) {
      await logActivity({
        type: "tailoring",
        matchId: (t.match as unknown as mongoose.Types.ObjectId).toString(),
        jobId: (t.job as unknown as mongoose.Types.ObjectId)?.toString(),
        status: "success",
        message: "Tailoring approved",
        details: { tailoredApplicationId: tailoredId }
      });
    }
  }
  return res.modifiedCount > 0;
}

/** Set status to used (e.g. after apply). */
export async function markTailoredApplicationUsed(
  tailoredId: string,
  userId: string
): Promise<boolean> {
  await connectToDatabase();
  const res = await TailoredApplication.updateOne(
    { _id: tailoredId, user: userId },
    { $set: { status: "used" as TailoredApplicationStatus } }
  );
  if (res.modifiedCount) {
    const t = await TailoredApplication.findById(tailoredId).lean();
    if (t?.match) {
      await logActivity({
        type: "tailoring",
        matchId: (t.match as unknown as mongoose.Types.ObjectId).toString(),
        jobId: (t.job as unknown as mongoose.Types.ObjectId)?.toString(),
        status: "success",
        message: "Tailoring used in application",
        details: { tailoredApplicationId: tailoredId }
      });
    }
  }
  return res.modifiedCount > 0;
}

/** Mark tailoring as used by match (e.g. after auto-apply success). */
export async function markTailoredApplicationUsedByMatch(
  matchId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): Promise<void> {
  await connectToDatabase();
  const t = await TailoredApplication.findOne({
    match: matchId,
    user: userId
  }).lean();
  if (!t) return;
  await TailoredApplication.updateOne(
    { _id: t._id },
    { $set: { status: "used" as TailoredApplicationStatus } }
  );
  await logActivity({
    type: "tailoring",
    matchId: String(matchId),
    jobId: t.job ? String(t.job) : undefined,
    status: "success",
    message: "Tailoring used in application",
    details: { tailoredApplicationId: String(t._id) }
  });
}

/** Get tailoring metrics for dashboard. */
export async function getTailoringMetrics(userId: string): Promise<{
  generated: number;
  pendingApproval: number;
  usedInApply: number;
  failureCount: number;
}> {
  await connectToDatabase();
  const { ActivityLog: ActivityLogModel } = await import("@/models/ActivityLog");
  const uid = new mongoose.Types.ObjectId(userId);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const [generated, pendingApproval, usedInApply, failureCountWeek] = await Promise.all([
    TailoredApplication.countDocuments({
      user: uid,
      status: { $in: ["generated", "approved", "used"] }
    }),
    TailoredApplication.countDocuments({ user: uid, status: "generated" }),
    TailoredApplication.countDocuments({ user: uid, status: "used" }),
    ActivityLogModel.countDocuments({
      type: "tailoring",
      status: "failed",
      createdAt: { $gte: startOfWeek }
    })
  ]);
  return {
    generated,
    pendingApproval,
    usedInApply,
    failureCount: failureCountWeek
  };
}
