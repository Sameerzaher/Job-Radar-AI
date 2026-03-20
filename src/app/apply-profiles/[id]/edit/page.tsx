import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateDefaultUser } from "@/services/userService";
import { getApplyProfileById, updateApplyProfile } from "@/services/applyProfiles/applyProfileService";
import { PageHeader } from "@/components/ui";
import { ApplyProfileForm } from "@/components/applyProfiles/ApplyProfileForm";
import type { ApplyProfileFormPayload } from "@/components/applyProfiles/ApplyProfileForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function updateProfileAction(
  profileId: string,
  formData: ApplyProfileFormPayload
) {
  "use server";
  const user = await getOrCreateDefaultUser();
  await updateApplyProfile(profileId, String(user._id), formData);
  redirect("/apply-profiles");
}

export default async function EditApplyProfilePage({ params }: Props) {
  const { id } = await params;
  const user = await getOrCreateDefaultUser();
  const profile = await getApplyProfileById(id, String(user._id));
  if (!profile) notFound();

  async function onSave(payload: ApplyProfileFormPayload, meta?: { profileId: string }) {
    "use server";
    if (!meta?.profileId) return;
    await updateProfileAction(meta.profileId, payload);
  }

  return (
    <div className="space-y-ds-section">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Link href="/apply-profiles" className="hover:text-slate-200">← Apply profiles</Link>
      </div>
      <PageHeader title={`Edit: ${profile.name}`} description="Update targeting, resume, and templates." />
      <ApplyProfileForm
        initialProfile={profile}
        onSave={onSave}
        cancelHref="/apply-profiles"
      />
    </div>
  );
}
