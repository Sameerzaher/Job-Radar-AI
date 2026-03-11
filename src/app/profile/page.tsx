import { redirect } from "next/navigation";
import { z } from "zod";
import { getOrCreateDefaultUser, updateUserProfile } from "@/services/userService";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/ui";

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
    <div className="space-y-ds-section">
      <PageHeader
        title="Profile"
        description="Tune how Job Radar AI evaluates roles against your preferences."
      />

      <ProfileForm initialUser={user} onSave={saveProfile} />
    </div>
  );
}
