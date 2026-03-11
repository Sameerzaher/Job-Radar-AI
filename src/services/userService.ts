import { connectToDatabase } from "@/lib/db";
import { User, type IUser } from "@/models/User";

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
    >
  >
): Promise<IUser> {
  const user = await getOrCreateDefaultUser();
  Object.assign(user, updates);
  await user.save();
  return user;
}

