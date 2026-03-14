import { getOrCreateDefaultUser } from "@/services/userService";
import {
  getDashboardStats,
  getApplicationStats,
  getOperationalMetrics,
  getGreenhouseMetrics,
  getAutoQueueMetrics
} from "@/services/jobService";
import { getTailoringMetrics } from "@/services/tailoredApplicationService";
import { getDiscoveryMetrics } from "@/services/discovery/discoveryMetrics";
import { getLastSync } from "@/services/syncService";
import { getTelegramDiagnostics } from "@/services/telegram";
import { PageHeader, Section, SectionCard, StatCard } from "@/components/ui";
import { LastSync } from "@/components/dashboard/LastSync";
import { SyncNowButton } from "@/components/dashboard/SyncNowButton";
import { DashboardControls } from "@/components/dashboard/DashboardControls";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getOrCreateDefaultUser();
  const [stats, lastSync, appStats, metrics, tailoringMetrics, discoveryMetrics, telegram, greenhouseMetrics, autoQueueMetrics] = await Promise.all([
    getDashboardStats(user),
    getLastSync(),
    getApplicationStats(user),
    getOperationalMetrics(user),
    getTailoringMetrics((user as { _id: { toString(): string } })._id.toString()),
    getDiscoveryMetrics(),
    getTelegramDiagnostics(),
    getGreenhouseMetrics(user),
    getAutoQueueMetrics(user)
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

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">
          Greenhouse auto-apply
        </h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Jobs with source=Greenhouse and supported apply URL. Eligible high-score jobs are auto-queued (no manual approval).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Greenhouse supported jobs" value={greenhouseMetrics.supportedJobs} />
          <StatCard label="Greenhouse queued" value={greenhouseMetrics.queued} />
          <StatCard label="Greenhouse applied today" value={greenhouseMetrics.appliedToday} />
          <StatCard label="Greenhouse needs_review today" value={greenhouseMetrics.needsReviewToday} />
        </div>
        <h3 className="mt-4 text-ds-body font-semibold text-slate-200">Auto-queue (today)</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Auto-queued today" value={autoQueueMetrics.autoQueuedToday} />
          <StatCard label="Greenhouse auto-queued today" value={autoQueueMetrics.greenhouseAutoQueuedToday} />
          <StatCard
            label="Last run: blocked by threshold"
            value={autoQueueMetrics.lastRunBlockedByThreshold ?? "—"}
            subtitle="Low score"
          />
          <StatCard
            label="Last run: blocked by rules"
            value={autoQueueMetrics.lastRunBlockedByRules ?? "—"}
            subtitle="Cooldown, age, etc."
          />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">
          Auto-apply status
        </h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Applications (Greenhouse, Lever, Workable). Trigger: POST /api/apply/auto
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
          <StatCard label="Eligible" value={appStats.eligible} subtitle="Score ≥ threshold" />
          <StatCard label="Queued" value={appStats.queued} />
          <StatCard label="Ready for review" value={appStats.readyForReview} />
          <StatCard label="Applied" value={appStats.applied} />
          <StatCard label="Applied with tailoring" value={appStats.appliedWithTailoring} subtitle="Used tailored cover letter" />
          <StatCard label="Failed" value={appStats.failed} />
          <StatCard label="Needs review" value={appStats.needsReview} />
          <StatCard label="Skipped (rules)" value={appStats.skippedRules} subtitle="Rules engine" />
          <StatCard label="Skipped (unsupported)" value={appStats.skippedUnsupported} subtitle="Source/URL" />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Tailoring</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tailored generated" value={tailoringMetrics.generated} />
          <StatCard label="Pending approval" value={tailoringMetrics.pendingApproval} />
          <StatCard label="Used in apply" value={tailoringMetrics.usedInApply} />
          <StatCard label="Tailoring failures (7d)" value={tailoringMetrics.failureCount} />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Discovery (today)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active boards" value={discoveryMetrics.totalActiveBoards} />
          <StatCard label="Jobs fetched today" value={discoveryMetrics.jobsFetchedToday} />
          <StatCard label="Jobs saved today" value={discoveryMetrics.jobsSavedToday} />
          <StatCard label="Sync failures" value={Object.values(discoveryMetrics.syncFailuresByProvider).reduce((a, b) => a + b, 0)} subtitle="By provider" />
        </div>
        <p className="mt-2 text-ds-caption text-slate-500">
          By provider: {Object.entries(discoveryMetrics.jobsByProvider).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
        </p>
        {discoveryMetrics.topBoardsByVolume.length > 0 && (
          <p className="mt-1 text-ds-caption text-slate-500">
            Top boards: {discoveryMetrics.topBoardsByVolume.slice(0, 5).map((b) => `${b.companyName} (${b.saved})`).join(", ")}
          </p>
        )}
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Operational metrics (last 7 days)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sync success" value={metrics.syncSuccessCount} />
          <StatCard label="Sync failure" value={metrics.syncFailureCount} />
          <StatCard label="Apply success rate" value={`${metrics.applySuccessRate}%`} />
          <StatCard label="Apply failure rate" value={`${metrics.applyFailureRate}%`} />
        </div>
        <p className="mt-2 text-ds-caption text-slate-500">
          Review queue: {metrics.reviewQueueCount} · Jobs by source: {Object.entries(metrics.jobsBySource).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
        </p>
        <p className="mt-1 text-ds-caption text-slate-500">
          Auto-apply worker heartbeat:{" "}
          {metrics.lastAutoApplyHeartbeat
            ? `${metrics.lastAutoApplyHeartbeat.toLocaleString()}${metrics.autoApplyWorkerStale ? " (stale)" : ""}`
            : "no heartbeat yet"}
          {metrics.lastAutoApplyRunCompletedAt && (
            <>
              {" "}| Last run: {metrics.lastAutoApplyRunCompletedAt.toLocaleString()} ({metrics.lastAutoApplyRunStatus ?? "unknown"})
            </>
          )}
        </p>
        <p className="mt-1 text-ds-caption text-slate-500">
          Telegram: {telegram.telegramConfigured ? "configured" : "missing (set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)"}
          {telegram.lastTelegramSuccessAt && ` · Last success: ${telegram.lastTelegramSuccessAt.toLocaleString()}`}
          {telegram.lastTelegramFailureAt && ` · Last failure: ${telegram.lastTelegramFailureAt.toLocaleString()}`}
          {telegram.lastTelegramError && ` · Error: ${telegram.lastTelegramError.slice(0, 80)}${telegram.lastTelegramError.length > 80 ? "…" : ""}`}
        </p>
      </SectionCard>

      <DashboardControls />
      <SyncNowButton />
    </div>
  );
}
