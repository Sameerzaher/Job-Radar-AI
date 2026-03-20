/**
 * CRUD and helpers for Apply Profiles (resume versions / apply profiles).
 */

import { connectToDatabase } from "@/lib/db";
import { ApplyProfile, type IApplyProfile } from "@/models/ApplyProfile";
import { User, type IUser } from "@/models/User";
import mongoose from "mongoose";

const LOG = "[JobRadar] ApplyProfile:";

export type ApplyProfileInput = {
  name: string;
  isDefault?: boolean;
  targetRoles?: string[];
  preferredKeywords?: string[];
  excludedKeywords?: string[];
  seniorityTargets?: string[];
  preferredLocations?: string[];
  remoteOnly?: boolean;
  resumeFilePath?: string;
  resumeText?: string;
  coverLetterTemplate?: string;
  recruiterMessageTemplate?: string;
  isActive?: boolean;
};

export async function listApplyProfilesByUser(userId: string): Promise<IApplyProfile[]> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(userId)) return [];
  const list = await ApplyProfile.find({ userId }).sort({ isDefault: -1, name: 1 }).lean();
  return list as unknown as IApplyProfile[];
}

export async function getApplyProfileById(
  id: string,
  userId: string
): Promise<IApplyProfile | null> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId))
    return null;
  const doc = await ApplyProfile.findOne({ _id: id, userId }).lean();
  return doc as unknown as IApplyProfile | null;
}

export async function createApplyProfile(
  userId: string,
  input: ApplyProfileInput
): Promise<IApplyProfile> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");
  if (input.isDefault) {
    await ApplyProfile.updateMany({ userId }, { $set: { isDefault: false } });
  }
  const doc = await ApplyProfile.create({
    userId,
    name: input.name.trim() || "Unnamed",
    isDefault: Boolean(input.isDefault),
    targetRoles: input.targetRoles ?? [],
    preferredKeywords: input.preferredKeywords ?? [],
    excludedKeywords: input.excludedKeywords ?? [],
    seniorityTargets: input.seniorityTargets ?? [],
    preferredLocations: input.preferredLocations ?? [],
    remoteOnly: Boolean(input.remoteOnly),
    resumeFilePath: (input.resumeFilePath ?? "").trim(),
    resumeText: (input.resumeText ?? "").trim(),
    coverLetterTemplate: (input.coverLetterTemplate ?? "").trim(),
    recruiterMessageTemplate: (input.recruiterMessageTemplate ?? "").trim(),
    isActive: input.isActive !== false
  });
  console.log(`${LOG} created profile id=${doc._id} name=${doc.name} userId=${userId}`);
  return doc as unknown as IApplyProfile;
}

export async function updateApplyProfile(
  id: string,
  userId: string,
  input: Partial<ApplyProfileInput>
): Promise<IApplyProfile | null> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId))
    return null;
  const existing = await ApplyProfile.findOne({ _id: id, userId });
  if (!existing) return null;
  if (input.isDefault === true) {
    await ApplyProfile.updateMany({ userId }, { $set: { isDefault: false } });
  }
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim() || "Unnamed";
  if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
  if (input.targetRoles !== undefined) updates.targetRoles = input.targetRoles;
  if (input.preferredKeywords !== undefined) updates.preferredKeywords = input.preferredKeywords;
  if (input.excludedKeywords !== undefined) updates.excludedKeywords = input.excludedKeywords;
  if (input.seniorityTargets !== undefined) updates.seniorityTargets = input.seniorityTargets;
  if (input.preferredLocations !== undefined) updates.preferredLocations = input.preferredLocations;
  if (input.remoteOnly !== undefined) updates.remoteOnly = input.remoteOnly;
  if (input.resumeFilePath !== undefined) updates.resumeFilePath = input.resumeFilePath.trim();
  if (input.resumeText !== undefined) updates.resumeText = input.resumeText.trim();
  if (input.coverLetterTemplate !== undefined)
    updates.coverLetterTemplate = input.coverLetterTemplate.trim();
  if (input.recruiterMessageTemplate !== undefined)
    updates.recruiterMessageTemplate = input.recruiterMessageTemplate.trim();
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  await ApplyProfile.updateOne({ _id: id, userId }, { $set: updates });
  const updated = await ApplyProfile.findOne({ _id: id, userId }).lean();
  return updated as unknown as IApplyProfile;
}

export async function deleteApplyProfile(id: string, userId: string): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId))
    return false;
  const result = await ApplyProfile.deleteOne({ _id: id, userId });
  if (result.deletedCount) console.log(`${LOG} deleted profile id=${id} userId=${userId}`);
  return result.deletedCount > 0;
}

export async function setDefaultApplyProfile(id: string, userId: string): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId))
    return false;
  const profile = await ApplyProfile.findOne({ _id: id, userId });
  if (!profile) return false;
  await ApplyProfile.updateMany({ userId }, { $set: { isDefault: false } });
  await ApplyProfile.updateOne({ _id: id, userId }, { $set: { isDefault: true } });
  console.log(`${LOG} set default profile id=${id} name=${profile.name}`);
  return true;
}

export async function setApplyProfileActive(
  id: string,
  userId: string,
  isActive: boolean
): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId))
    return false;
  const result = await ApplyProfile.updateOne(
    { _id: id, userId },
    { $set: { isActive } }
  );
  return result.modifiedCount > 0;
}

/** Get the default apply profile for a user, or null if none. */
export async function getDefaultApplyProfile(
  userId: string | { _id: unknown }
): Promise<IApplyProfile | null> {
  await connectToDatabase();
  const uid = typeof userId === "string" ? userId : String(userId._id);
  if (!mongoose.Types.ObjectId.isValid(uid)) return null;
  const doc = await ApplyProfile.findOne({ userId: uid, isDefault: true, isActive: true }).lean();
  return doc as unknown as IApplyProfile | null;
}

/** Get active apply profiles for selection (used by selectBestApplyProfile). */
export async function getActiveApplyProfilesForUser(
  userId: string | { _id: unknown }
): Promise<IApplyProfile[]> {
  await connectToDatabase();
  const uid = typeof userId === "string" ? userId : String(userId._id);
  if (!mongoose.Types.ObjectId.isValid(uid)) return [];
  const list = await ApplyProfile.find({ userId: uid, isActive: true })
    .sort({ isDefault: -1, name: 1 })
    .lean();
  return list as unknown as IApplyProfile[];
}

/**
 * Create one default apply profile from the current user's fields (for migration / first-time).
 * Call when user has no apply profiles and we want to seed one.
 */
export async function createDefaultApplyProfileFromUser(
  user: IUser
): Promise<IApplyProfile | null> {
  await connectToDatabase();
  const uid = String(user._id);
  const existing = await ApplyProfile.countDocuments({ userId: uid });
  if (existing > 0) return null;
  const u = user as IUser & {
    resumeFilePath?: string;
    resumeText?: string;
    defaultCoverLetter?: string;
    defaultCoverLetterTemplate?: string;
    preferredLocations?: string[];
    seniority?: string;
    targetRoles?: string[];
  };
  const doc = await ApplyProfile.create({
    userId: user._id,
    name: "Default (from profile)",
    isDefault: true,
    targetRoles: u.targetRoles ?? [],
    preferredKeywords: [],
    excludedKeywords: (user as IUser & { excludedKeywords?: string[] }).excludedKeywords ?? [],
    seniorityTargets: u.seniority ? [u.seniority] : [],
    preferredLocations: u.preferredLocations ?? [],
    remoteOnly: false,
    resumeFilePath: (u.resumeFilePath ?? "").trim(),
    resumeText: (u.resumeText ?? "").trim(),
    coverLetterTemplate: (u.defaultCoverLetterTemplate ?? u.defaultCoverLetter ?? "").trim(),
    recruiterMessageTemplate: "",
    isActive: true
  });
  console.log(`${LOG} created default profile from user id=${doc._id} name=${doc.name}`);
  return doc as unknown as IApplyProfile;
}
