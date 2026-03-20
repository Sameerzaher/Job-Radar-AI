import { connectToDatabase } from "@/lib/db";
import { User, type IUser, type SavedSearchEntry, type ScoreWeights } from "@/models/User";

export const DEFAULT_USER_EMAIL = "default@jobradar.ai";

export async function getOrCreateDefaultUser(): Promise<IUser> {
  await connectToDatabase();

  let user = await User.findOne({ email: DEFAULT_USER_EMAIL });
  if (!user) {
    user = await User.create({
      email: DEFAULT_USER_EMAIL,
      name: "Default Candidate",
      targetRoles: ["Full Stack Developer", "Backend Developer"],
      skills: ["Node.js", "React", "Next.js", "TypeScript", "MongoDB", "Docker"],
      preferredLocations: ["Israel", "Remote"],
      workModes: ["Remote", "Hybrid"],
      seniority: "junior-mid"
    });
  }

  return user;
}

export async function updateUserProfile(
  updates: Partial<
    Pick<
      IUser,
      | "name"
      | "targetRoles"
      | "skills"
      | "preferredLocations"
      | "workModes"
      | "seniority"
      | "excludedKeywords"
      | "resumeText"
      | "baseResumeText"
      | "defaultCoverLetterTemplate"
      | "yearsOfExperience"
      | "keyProjects"
      | "achievements"
      | "phone"
      | "linkedinUrl"
      | "githubUrl"
      | "portfolioUrl"
      | "resumeFilePath"
      | "defaultCoverLetter"
      | "scoreWeights"
      | "autoApplyBlacklistCompanies"
      | "autoApplyReviewRequiredCompanies"
    >
  >
): Promise<IUser> {
  const user = await getOrCreateDefaultUser();
  Object.assign(user, updates);
  await user.save();
  return user;
}

export async function getSavedSearches(): Promise<SavedSearchEntry[]> {
  const user = await getOrCreateDefaultUser();
  const list = (user as IUser & { savedSearches?: SavedSearchEntry[] }).savedSearches ?? [];
  return list.map((s) => ({
    ...s,
    _id: (s as { _id?: unknown })._id != null ? String((s as { _id: unknown })._id) : undefined
  }));
}

export async function addSavedSearch(
  name: string,
  filters: Record<string, string | number | boolean>
): Promise<SavedSearchEntry> {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();
  const list = (user as IUser & { savedSearches?: SavedSearchEntry[] }).savedSearches ?? [];
  list.push({ name, filters } as SavedSearchEntry);
  (user as IUser & { savedSearches: SavedSearchEntry[] }).savedSearches = list;
  await user.save();
  const added = list[list.length - 1] as SavedSearchEntry & { _id?: unknown };
  return {
    _id: added._id != null ? String(added._id) : undefined,
    name,
    filters
  };
}

export async function deleteSavedSearch(searchId: string): Promise<void> {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();
  const list = (user as IUser & { savedSearches?: SavedSearchEntry[] }).savedSearches ?? [];
  const filtered = list.filter((s) => String((s as { _id?: unknown })._id) !== searchId);
  (user as IUser & { savedSearches: SavedSearchEntry[] }).savedSearches = filtered;
  await user.save();
}

