import { getOrCreateDefaultUser } from "@/services/userService";
import { getDashboardStats } from "@/services/jobService";
import { getLastSync } from "@/services/syncService";
import { StatCard } from "@/components/dashboard/StatCard";
import { LastSync } from "@/components/dashboard/LastSync";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getOrCreateDefaultUser();
  const [stats, lastSync] = await Promise.all([
    getDashboardStats(user),
    getLastSync()
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Radar overview
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            A quick snapshot of how well current roles match your profile.
          </p>
        </div>
        <div className="glass-panel flex items-center gap-3 px-4 py-3 text-sm text-slate-300">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10" />
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{user.name}</span>
            <span className="text-xs text-slate-400">
              {user.targetRoles.join(" · ")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total jobs" value={stats.totalJobs} />
        <StatCard label="New" value={stats.newJobs} />
        <StatCard
          label="High match"
          value={stats.highMatchJobs}
          subtitle="Score ≥ 70"
        />
        <StatCard label="Saved" value={stats.savedJobs} />
      </div>

      <LastSync lastSync={lastSync} />

      <div className="glass-panel p-4 sm:p-6">
        <p className="text-sm font-medium text-slate-100">
          Job ingestion pipeline
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Scheduled sync runs every 6 hours via <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">npm run sync:cron</code>.
          Trigger manually: <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">POST /api/admin/sync</code> with optional <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">x-api-key</code> if <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">ADMIN_API_KEY</code> is set.
        </p>
      </div>
    </div>
  );
}
