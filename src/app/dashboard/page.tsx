import { getOrCreateDefaultUser } from "@/services/userService";
import { getDashboardStats } from "@/services/jobService";
import { getLastSync } from "@/services/syncService";
import { PageHeader, Section, SectionCard, StatCard } from "@/components/ui";
import { LastSync } from "@/components/dashboard/LastSync";
import { SyncNowButton } from "@/components/dashboard/SyncNowButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getOrCreateDefaultUser();
  const [stats, lastSync] = await Promise.all([
    getDashboardStats(user),
    getLastSync()
  ]);

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Radar overview"
        description="A quick snapshot of how well current roles match your profile."
        action={
          <SectionCard className="!py-3 !px-4 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-ds-body font-medium text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-ds-body font-medium text-slate-100">
                {user.name}
              </p>
              <p className="truncate text-ds-caption text-slate-500">
                {user.targetRoles.join(" · ") || "—"}
              </p>
            </div>
          </SectionCard>
        }
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total jobs" value={stats.totalJobs} />
          <StatCard label="New" value={stats.newJobs} />
          <StatCard
            label="High match"
            value={stats.highMatchJobs}
            subtitle="Score ≥ 70"
          />
          <StatCard label="Saved" value={stats.savedJobs} />
        </div>
      </Section>

      <LastSync lastSync={lastSync} />

      <SyncNowButton />
    </div>
  );
}
