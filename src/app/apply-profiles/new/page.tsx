import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateDefaultUser } from "@/services/userService";
import { createApplyProfile } from "@/services/applyProfiles/applyProfileService";
import { PageHeader } from "@/components/ui";
import { ApplyProfileForm } from "@/components/applyProfiles/ApplyProfileForm";

export const dynamic = "force-dynamic";

async function createAction(
  formData: {
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
  },
  _meta?: { profileId: string }
) {
  "use server";
  const user = await getOrCreateDefaultUser();
  await createApplyProfile(String(user._id), formData);
  redirect("/apply-profiles");
}

export default async function NewApplyProfilePage() {
  await getOrCreateDefaultUser();

  return (
    <div className="space-y-ds-section">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Link href="/apply-profiles" className="hover:text-slate-200">← Apply profiles</Link>
      </div>
      <PageHeader title="New apply profile" description="Create a resume version with its own targeting and templates." />
      <ApplyProfileForm onSave={createAction} cancelHref="/apply-profiles" />
    </div>
  );
}
