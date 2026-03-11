"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import {
  listTailoredApplicationsForUser,
  getTailoredApplicationById,
  ensureTailoredApplication,
  runTailoringGeneration,
  approveTailoredApplication,
  markTailoredApplicationUsed
} from "@/services/tailoredApplicationService";

export async function listTailored() {
  const user = await getOrCreateDefaultUser();
  return listTailoredApplicationsForUser((user as { _id: { toString(): string } })._id.toString());
}

export async function getTailoredById(id: string) {
  const user = await getOrCreateDefaultUser();
  return getTailoredApplicationById(id, (user as { _id: { toString(): string } })._id.toString());
}

/** Ensure a TailoredApplication exists for this match; optionally generate. Returns tailored id. */
export async function ensureAndGenerate(matchId: string, generateIfMissing: boolean) {
  const user = await getOrCreateDefaultUser();
  const userId = (user as { _id: { toString(): string } })._id.toString();
  const { tailored } = await ensureTailoredApplication(matchId, userId, {
    generateIfMissing
  });
  revalidatePath("/tailored");
  revalidatePath("/review");
  return { tailoredId: (tailored as { _id: { toString(): string } })._id.toString() };
}

/** Regenerate tailoring for an existing TailoredApplication. */
export async function regenerateTailoring(tailoredId: string) {
  const user = await getOrCreateDefaultUser();
  const userId = (user as { _id: { toString(): string } })._id.toString();
  const { generated } = await runTailoringGeneration(tailoredId, userId);
  revalidatePath("/tailored");
  revalidatePath(`/tailored/${tailoredId}`);
  return { generated };
}

/** Approve tailored application. */
export async function approveTailored(tailoredId: string) {
  const user = await getOrCreateDefaultUser();
  const ok = await approveTailoredApplication(
    tailoredId,
    (user as { _id: { toString(): string } })._id.toString()
  );
  revalidatePath("/tailored");
  revalidatePath(`/tailored/${tailoredId}`);
  return { ok };
}

/** Mark tailored application as used (e.g. after apply). */
export async function markTailoredUsed(tailoredId: string) {
  const user = await getOrCreateDefaultUser();
  const ok = await markTailoredApplicationUsed(
    tailoredId,
    (user as { _id: { toString(): string } })._id.toString()
  );
  revalidatePath("/tailored");
  revalidatePath(`/tailored/${tailoredId}`);
  return { ok };
}
