import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import {
  listApplyProfilesByUser,
  setDefaultApplyProfile,
  setApplyProfileActive,
  deleteApplyProfile
} from "@/services/applyProfiles/applyProfileService";
import { PageHeader, SectionCard, Button, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

async function setDefaultAction(id: string) {
  "use server";
  const { getOrCreateDefaultUser: getUser } = await import("@/services/userService");
  const user = await getUser();
  if (!user) return;
  await setDefaultApplyProfile(id, String(user._id));
  revalidatePath("/apply-profiles");
}

async function setActiveAction(id: string, isActive: boolean) {
  "use server";
  const { getOrCreateDefaultUser: getUser } = await import("@/services/userService");
  const user = await getUser();
  if (!user) return;
  await setApplyProfileActive(id, String(user._id), isActive);
  revalidatePath("/apply-profiles");
}

async function deleteAction(id: string) {
  "use server";
  const { getOrCreateDefaultUser: getUser } = await import("@/services/userService");
  const user = await getUser();
  if (!user) return;
  await deleteApplyProfile(id, String(user._id));
  revalidatePath("/apply-profiles");
}

export default async function ApplyProfilesPage() {
  const user = await getOrCreateDefaultUser();
  const profiles = await listApplyProfilesByUser(String(user._id));

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Apply profiles"
        description="Resume versions and application profiles. Each profile has its own resume, cover letter template, and targeting (roles, keywords, locations). The system picks the best profile per job."
      />
      <SectionCard>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-ds-title font-semibold text-slate-100">Profiles</h2>
          <Link href="/apply-profiles/new">
            <Button type="button" size="sm">New profile</Button>
          </Link>
        </div>
        {profiles.length === 0 ? (
          <p className="mt-4 text-slate-400">
            No apply profiles yet. Create one to use different resumes and cover letters per role type (e.g. Full Stack, Backend). If you don’t create any, the app uses your main profile resume and cover letter.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Name</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Default</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Active</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200 max-w-[200px]">Resume path</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Target roles</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={String(p._id)} className="border-b border-slate-700/50 hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium text-slate-200">{p.name}</td>
                    <td className="px-3 py-2.5">
                      {p.isDefault ? <Badge variant="score-high">Default</Badge> : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.isActive ? (
                        <span className="text-emerald-400">Active</span>
                      ) : (
                        <span className="text-slate-500">Inactive</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-400" title={p.resumeFilePath || ""}>
                      {p.resumeFilePath || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {(p.targetRoles ?? []).length ? (p.targetRoles ?? []).slice(0, 3).join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link href={`/apply-profiles/${p._id}/edit`}>
                          <Button type="button" variant="ghost" size="sm">Edit</Button>
                        </Link>
                        {!p.isDefault && (
                          <form action={setDefaultAction.bind(null, String(p._id))} className="inline">
                            <Button type="submit" variant="ghost" size="sm">Set default</Button>
                          </form>
                        )}
                        <form action={setActiveAction.bind(null, String(p._id), !p.isActive)} className="inline">
                          <Button type="submit" variant="ghost" size="sm">
                            {p.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                        <form action={deleteAction.bind(null, String(p._id))} className="inline">
                          <Button type="submit" variant="danger" size="sm">Delete</Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
