import { redirect } from "next/navigation";
import { z } from "zod";
import { getOrCreateDefaultUser, updateUserProfile } from "@/services/userService";
import { ProfileForm } from "@/components/profile/ProfileForm";

const profileSchema = z.object({
  name: z.string().min(1),
  targetRoles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  preferredLocations: z.array(z.string()).default([]),
  workModes: z.array(z.string()).default([]),
  seniority: z.string(),
  excludedKeywords: z.array(z.string()).default([]),
  resumeText: z.string().optional()
});

export const dynamic = "force-dynamic";

async function saveProfile(formData: {
  name: string;
  targetRoles: string[];
  skills: string[];
  preferredLocations: string[];
  workModes: string[];
  seniority: string;
  excludedKeywords?: string[];
  resumeText?: string;
}) {
  "use server";

  const parsed = profileSchema.parse(formData);
  await updateUserProfile(parsed);
  redirect("/profile");
}

export default async function ProfilePage() {
  const user = await getOrCreateDefaultUser();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Tune how Job Radar AI evaluates roles against your preferences.
        </p>
      </div>

      <ProfileForm initialUser={user} onSave={saveProfile} />
    </div>
  );
}

