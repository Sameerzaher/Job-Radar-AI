import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import { getAutoApplyDiagnostics } from "@/services/autoApply/diagnostics";
import { getApplicationStats, getOperationalMetrics, getGreenhouseReadiness, queueGreenhouseAutoApplyJobs, getAutoQueueMetrics } from "@/services/jobService";
import { getTelegramDiagnostics } from "@/services/telegram";
import {
  getLiveVerificationData,
  getProviderPerformance,
  getRecentApplications,
  getRecentGreenhouseAttempts,
  getGreenhouseOutcomeMetrics,
  getProviderHealthRecommendation,
  getApplicationsByApplyProfile
} from "@/services/autoApply/providerPerformance";
import { listCompanyMemoriesByUser } from "@/services/companyMemory/companyMemoryService";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";
import { WorkerTriggerButton } from "@/components/operations/WorkerTriggerButton";
import { QueueGreenhouseButton } from "@/components/operations/QueueGreenhouseButton";

export const dynamic = "force-dynamic";

async function queueGreenhouseAction() {
  "use server";
  const user = await getOrCreateDefaultUser();
  const result = await queueGreenhouseAutoApplyJobs(user);
  revalidatePath("/operations/auto-apply");
  revalidatePath("/dashboard");
  revalidatePath("/review");
  return result;
}

export default async function AutoApplyOperationsPage() {
  const user = await getOrCreateDefaultUser();
  const [diagnostics, appStats, metrics, telegram, liveData, providerStats, recentApps, greenhouseReadiness, greenhouseOutcomes, recentGreenhouse, autoQueueMetrics, applyProfileMetrics, companyMemories] = await Promise.all([
    getAutoApplyDiagnostics(user),
    getApplicationStats(user),
    getOperationalMetrics(user),
    getTelegramDiagnostics(),
    getLiveVerificationData(user),
    getProviderPerformance(user),
    getRecentApplications(user, 50),
    getGreenhouseReadiness(user),
    getGreenhouseOutcomeMetrics(user),
    getRecentGreenhouseAttempts(user, 50),
    getAutoQueueMetrics(user),
    getApplicationsByApplyProfile(user),
    listCompanyMemoriesByUser(user)
  ]);

  const lock = diagnostics.lockState;
  const resumePath = (user as { resumeFilePath?: string }).resumeFilePath?.trim();
  const workerConfigured = Boolean(metrics.lastAutoApplyHeartbeat ?? lock?.heartbeatAt);
  const workerNotRunning = !workerConfigured || metrics.autoApplyWorkerStale;

  const liveWarnings: string[] = [];
  if (metrics.autoApplyWorkerStale || !metrics.lastAutoApplyHeartbeat) liveWarnings.push("Worker heartbeat is stale or missing");
  if (!telegram.telegramConfigured) liveWarnings.push("Telegram is not configured");
  if (!resumePath) liveWarnings.push("Resume path is missing");
  if (!diagnostics.autoApplyEnabled) liveWarnings.push("AUTO_APPLY_ENABLED is false");
  if (diagnostics.dryRunDefault) liveWarnings.push("DRY_RUN_DEFAULT is true (no real applications)");
  const liveReady = liveWarnings.length === 0;

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Auto-apply operations"
        description="Greenhouse readiness, recent attempts, live verification, and worker diagnostics."
      />
      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Greenhouse live readiness</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Compact view: supported jobs, queued, attempted/applied today, success rate.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Supported jobs" value={greenhouseReadiness.supportedJobs} />
          <StatCard label="Queued" value={greenhouseReadiness.queued} />
          <StatCard label="Attempted today" value={greenhouseReadiness.attemptedToday} />
          <StatCard label="Applied today" value={greenhouseReadiness.appliedToday} />
          <StatCard
            label="Success rate"
            value={greenhouseReadiness.successRate != null ? `${greenhouseReadiness.successRate}%` : "—"}
          />
        </div>
        <div className="mt-4">
          <QueueGreenhouseButton queueAction={queueGreenhouseAction} />
        </div>
        <h3 className="mt-6 text-ds-body font-semibold text-slate-200">Greenhouse outcome metrics (today)</h3>
        <p className="mt-1 text-ds-caption text-slate-500">
          Submit attempted = confirmed + needs_review after submit; blocked = before submit (e.g. required field, submit button not found).
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Submit attempted" value={greenhouseOutcomes.submitAttempted} />
          <StatCard label="Submit confirmed" value={greenhouseOutcomes.submitConfirmed} />
          <StatCard label="Needs review after submit" value={greenhouseOutcomes.needsReviewAfterSubmit} />
          <StatCard label="Blocked before submit" value={greenhouseOutcomes.blockedBeforeSubmit} />
        </div>
        <h3 className="mt-4 text-ds-body font-semibold text-slate-200">Auto-queue (today)</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Auto-queued today" value={autoQueueMetrics.autoQueuedToday} />
          <StatCard label="Greenhouse auto-queued today" value={autoQueueMetrics.greenhouseAutoQueuedToday} />
          <StatCard label="Last run: blocked by threshold" value={autoQueueMetrics.lastRunBlockedByThreshold ?? "—"} />
          <StatCard label="Last run: blocked by rules" value={autoQueueMetrics.lastRunBlockedByRules ?? "—"} />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Applications by company memory</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Application history per company (normalized). Used for cooldowns and duplicate prevention.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/20">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/60">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Company</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Total</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Last outcome</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Applied %</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Last applied at</th>
                </tr>
              </thead>
              <tbody>
                {companyMemories.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No company memory yet (applications will populate this)</td></tr>
                ) : (
                  companyMemories.slice(0, 100).map((mem) => {
                    const total = mem.totalApplications || 1;
                    const pct = total ? Math.round((mem.totalApplied / total) * 100) : 0;
                    return (
                      <tr key={mem._id?.toString() ?? mem.normalizedCompanyName} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/40 last:border-b-0">
                        <td className="px-3 py-2.5 font-medium text-slate-200">{mem.displayCompanyName}</td>
                        <td className="px-3 py-2.5 text-right">{mem.totalApplications}</td>
                        <td className="px-3 py-2.5">{mem.lastOutcome ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right">{pct}%</td>
                        <td className="px-3 py-2.5">{mem.lastAppliedAt ? new Date(mem.lastAppliedAt).toLocaleString() : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Recent Greenhouse attempts</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Last 50 Greenhouse application attempts (applied, failed, needs_review) for verification.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/20">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/60">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Title</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Company</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200 max-w-[240px]">Failure reason</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Applied at</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-200">Tailored</th>
                </tr>
              </thead>
              <tbody>
                {recentGreenhouse.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No Greenhouse attempts yet</td></tr>
                ) : (
                  recentGreenhouse.map((a) => (
                    <tr key={a.matchId} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/40 last:border-b-0">
                      <td className="px-3 py-2.5">{a.title}</td>
                      <td className="px-3 py-2.5">{a.company}</td>
                      <td className="px-3 py-2.5">{a.finalStatus}</td>
                      <td className="max-w-[240px] truncate px-3 py-2.5 text-slate-400" title={a.failureReason ?? ""}>{a.failureReason ?? "—"}</td>
                      <td className="px-3 py-2.5">{a.appliedAt ? new Date(a.appliedAt).toLocaleString() : "—"}</td>
                      <td className="px-3 py-2.5 text-center">{a.tailoredUsedInApply ? "Yes" : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Live verification</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Worker status and today&apos;s auto-apply activity.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Worker running" value={liveData.workerRunning ? "Yes" : "No"} />
          <StatCard
            label="Last heartbeat"
            value={liveData.lastHeartbeatAt ? new Date(liveData.lastHeartbeatAt).toLocaleString() : "—"}
          />
          <StatCard
            label="Last run started"
            value={liveData.lastRunStartedAt ? new Date(liveData.lastRunStartedAt).toLocaleString() : "—"}
          />
          <StatCard
            label="Last run completed"
            value={liveData.lastRunCompletedAt ? new Date(liveData.lastRunCompletedAt).toLocaleString() : "—"}
          />
          <StatCard label="Current mode" value={liveData.currentMode === "live" ? "Live" : "Dry run"} />
          <StatCard label="Queue size" value={liveData.queueSize} />
          <StatCard label="Applied today" value={liveData.appliedToday} />
          <StatCard label="Needs review today" value={liveData.needsReviewToday} />
          <StatCard label="Skipped (rules) today" value={liveData.skippedRulesToday} />
          <StatCard label="Skipped (unsupported) today" value={liveData.skippedUnsupportedToday} />
          <StatCard label="Failed today" value={liveData.failedToday} />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Live readiness</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Warnings that block or affect full live auto-apply.
        </p>
        <div className={`mt-4 rounded-xl border px-5 py-4 ${liveReady ? "border-emerald-600/60 bg-emerald-900/20 text-emerald-200" : "border-amber-600/60 bg-amber-900/20 text-amber-200"}`}>
          {liveReady ? (
            <p className="font-medium">Ready for live. No warnings.</p>
          ) : (
            <ul className="list-inside list-disc space-y-2 text-sm">
              {liveWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      {applyProfileMetrics.length > 0 && (
        <SectionCard>
          <h2 className="text-ds-title font-semibold text-slate-100">Applications by apply profile</h2>
          <p className="mt-1 text-ds-caption text-slate-500">
            Applied, failed, needs_review, and success rate per profile.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/20">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/60">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Profile</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Applied</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Failed</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Needs review</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Success rate</th>
                </tr>
              </thead>
              <tbody>
                {applyProfileMetrics.map((row) => (
                  <tr key={row.profileName} className="border-b border-slate-700/50 hover:bg-slate-800/40 last:border-b-0">
                    <td className="px-3 py-2.5 font-medium text-slate-200">{row.profileName}</td>
                    <td className="px-3 py-2.5 text-right">{row.applied}</td>
                    <td className="px-3 py-2.5 text-right">{row.failed}</td>
                    <td className="px-3 py-2.5 text-right">{row.needsReview}</td>
                    <td className="px-3 py-2.5 text-right">{row.successRate != null ? `${row.successRate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Provider performance (today)</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Per-provider attempted, applied, failed, needs_review, success rate.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/20">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/60">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Provider</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Attempted</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Applied</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Needs review</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Skipped (URL)</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Failed</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-200">Success rate</th>
                </tr>
              </thead>
              <tbody>
                {providerStats.map((s) => (
                  <tr key={s.provider} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/40 last:border-b-0">
                    <td className="px-3 py-2.5 font-medium text-slate-200">{s.provider}</td>
                    <td className="px-3 py-2.5 text-right">{s.attempted}</td>
                    <td className="px-3 py-2.5 text-right">{s.applied}</td>
                    <td className="px-3 py-2.5 text-right">{s.needs_review}</td>
                    <td className="px-3 py-2.5 text-right">{s.skipped_unsupported}</td>
                    <td className="px-3 py-2.5 text-right">{s.failed}</td>
                    <td className="px-3 py-2.5 text-right">{s.successRate != null ? `${s.successRate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {providerStats.map((s) => {
            const text = getProviderHealthRecommendation(s);
            const t = text.toLowerCase();
            const severity = t.includes("ready for live") || t.includes("no attempts today") ? "success" : t.includes("low success") || t.includes("keep manual") || t.includes("review-only") ? "danger" : "warning";
            return (
              <div
                key={s.provider}
                className={`rounded-lg border px-4 py-3 text-sm min-w-[200px] ${
                  severity === "success"
                    ? "border-emerald-600/50 bg-emerald-900/20 text-emerald-200"
                    : severity === "danger"
                      ? "border-red-600/50 bg-red-900/20 text-red-200"
                      : "border-amber-600/50 bg-amber-900/20 text-amber-200"
                }`}
              >
                <p className="font-semibold">{s.provider}</p>
                <p className="mt-0.5 opacity-95">{text}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Recent applications (last 50)</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Title, company, provider, status, failure reason, applied at, tailored used.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/20">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/60">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Title</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Company</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Provider</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200 max-w-[200px]">Failure reason</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-200">Applied at</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-200">Tailored</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No applications yet</td></tr>
                ) : (
                  recentApps.map((a) => (
                    <tr key={a.matchId} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/40 last:border-b-0">
                      <td className="px-3 py-2.5">{a.title}</td>
                      <td className="px-3 py-2.5">{a.company}</td>
                      <td className="px-3 py-2.5">{a.provider}</td>
                      <td className="px-3 py-2.5">{a.finalStatus}</td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-400" title={a.failureReason ?? ""}>{a.failureReason ?? "—"}</td>
                      <td className="px-3 py-2.5">{a.appliedAt ? new Date(a.appliedAt).toLocaleString() : "—"}</td>
                      <td className="px-3 py-2.5 text-center">{a.tailoredUsedInApply ? "Yes" : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {workerNotRunning && (
        <div className="rounded-xl border-l-4 border-amber-500 border-amber-600/60 bg-amber-900/20 px-5 py-4 text-amber-200 shadow-sm">
          <p className="font-semibold">Auto-apply worker is not running</p>
          <p className="mt-1.5 text-sm text-amber-200/90">
            Start the worker with <code className="rounded bg-amber-900/40 px-2 py-0.5 font-mono text-sm">npm run worker:auto-apply</code> or trigger one cycle below.
          </p>
        </div>
      )}

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Operational checklist</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Verify these before relying on automatic execution.
        </p>
        <ul className="mt-4 space-y-2">
          {[
            { ok: diagnostics.autoApplyEnabled, label: "Live mode enabled", detail: `AUTO_APPLY_ENABLED = ${String(diagnostics.autoApplyEnabled)}` },
            { ok: !diagnostics.dryRunDefault, label: "Dry run", detail: `DRY_RUN_DEFAULT = ${String(diagnostics.dryRunDefault)}${diagnostics.dryRunDefault ? " (no real applications)" : ""}` },
            { ok: workerConfigured, label: "Worker configured", detail: workerConfigured ? "Heartbeat present" : "No heartbeat yet (run a cycle or start worker)" },
            { ok: true, label: "Supported URL", detail: "Greenhouse, Lever, Workable. Custom pages → skipped_unsupported." },
            { ok: !!resumePath, label: "Resume path", detail: resumePath || "Set resumeFilePath in Profile" },
            { ok: telegram.telegramConfigured, label: "Telegram", detail: telegram.telegramConfigured ? "Yes" : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID" }
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <span className={`mt-0.5 shrink-0 text-lg ${item.ok ? "text-emerald-400" : "text-amber-400"}`}>
                {item.ok ? "✓" : "✗"}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-200">{item.label}</p>
                <p className="mt-0.5 text-slate-400">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Auto-apply diagnostics</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Configuration and live state of the auto-apply worker.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="AUTO_APPLY_ENABLED"
            value={diagnostics.autoApplyEnabled ? "true" : "false"}
          />
          <StatCard
            label="DRY_RUN_DEFAULT"
            value={diagnostics.dryRunDefault ? "true" : "false"}
          />
          <StatCard label="Queued jobs" value={diagnostics.queuedCount} />
          <StatCard label="Approved jobs" value={diagnostics.approvedCount} />
          <StatCard label="Needs review" value={diagnostics.needsReviewCount} />
          <StatCard
            label="Eligible"
            value={appStats.eligible}
            subtitle="Score ≥ threshold"
          />
        </div>
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-800/30 p-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Lock state</dt>
              <dd className="mt-0.5 text-sm text-slate-200">
                {lock
                  ? `${lock.locked ? "Locked" : "Unlocked"}${lock.lockedBy ? ` by ${lock.lockedBy}` : ""}`
                  : "No lock document yet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Last heartbeat</dt>
              <dd className="mt-0.5 text-sm text-slate-200">
                {lock?.heartbeatAt ? new Date(lock.heartbeatAt).toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Last run started</dt>
              <dd className="mt-0.5 text-sm text-slate-200">
                {metrics.lastAutoApplyRunStartedAt ? metrics.lastAutoApplyRunStartedAt.toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Last run completed</dt>
              <dd className="mt-0.5 text-sm text-slate-200">
                {metrics.lastAutoApplyRunCompletedAt ? metrics.lastAutoApplyRunCompletedAt.toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Last run status</dt>
              <dd className="mt-0.5 text-sm text-slate-200">{metrics.lastAutoApplyRunStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Worker heartbeat</dt>
              <dd className="mt-0.5 text-sm text-slate-200">
                {metrics.lastAutoApplyHeartbeat
                  ? `${metrics.lastAutoApplyHeartbeat.toLocaleString()}${metrics.autoApplyWorkerStale ? " (stale)" : ""}`
                  : "No heartbeat yet"}
              </dd>
            </div>
          </dl>
          {lock?.lastRunSummary && typeof lock.lastRunSummary === "object" && (
            <div className="mt-4 border-t border-slate-700/60 pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Last run summary</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-200">
                <span><strong className="text-slate-400">Applied:</strong> {String((lock.lastRunSummary as Record<string, unknown>).applied ?? "—")}</span>
                <span><strong className="text-slate-400">Failed:</strong> {String((lock.lastRunSummary as Record<string, unknown>).failed ?? "—")}</span>
                <span><strong className="text-slate-400">Needs review:</strong> {String((lock.lastRunSummary as Record<string, unknown>).needsReview ?? "—")}</span>
              </div>
            </div>
          )}
          {lock?.lastError && (
            <p className="mt-4 border-t border-slate-700/60 pt-4 text-sm text-amber-400">
              <strong>Last error:</strong> {lock.lastError}
            </p>
          )}
        </div>
        <div className="mt-4">
          <p className="mb-2 text-ds-caption font-medium text-slate-400">Manual trigger (same logic as scheduled worker)</p>
          <WorkerTriggerButton />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Telegram notifications</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Status of Telegram bot (application success, batch summary, high-match). Test: GET /api/test/telegram
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Configured"
            value={telegram.telegramConfigured ? "Yes" : "No"}
            subtitle={!telegram.telegramConfigured ? "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID" : undefined}
          />
          <StatCard label="Token set" value={telegram.tokenPresent ? "Yes" : "No"} />
          <StatCard label="Chat ID set" value={telegram.chatIdPresent ? "Yes" : "No"} />
        </div>
        <div className="mt-4 space-y-1 text-ds-caption text-slate-400">
          <p>Last success: {telegram.lastTelegramSuccessAt ? telegram.lastTelegramSuccessAt.toLocaleString() : "—"}</p>
          <p>Last failure: {telegram.lastTelegramFailureAt ? telegram.lastTelegramFailureAt.toLocaleString() : "—"}</p>
          {telegram.lastTelegramError && (
            <p className="text-amber-400">Last error: {telegram.lastTelegramError}</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

