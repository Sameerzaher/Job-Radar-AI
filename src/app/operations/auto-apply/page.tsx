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
  getProviderHealthRecommendation
} from "@/services/autoApply/providerPerformance";
import { SectionCard, StatCard } from "@/components/ui";
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
  const [diagnostics, appStats, metrics, telegram, liveData, providerStats, recentApps, greenhouseReadiness, greenhouseOutcomes, recentGreenhouse, autoQueueMetrics] = await Promise.all([
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
    getAutoQueueMetrics(user)
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
        <h2 className="text-ds-title font-semibold text-slate-100">Recent Greenhouse attempts</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Last 50 Greenhouse application attempts (applied, failed, needs_review) for verification.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="py-2 text-left font-medium">Title</th>
                <th className="py-2 text-left">Company</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left max-w-[240px]">Failure reason</th>
                <th className="py-2 text-left">Applied at</th>
                <th className="py-2 text-center">Tailored</th>
              </tr>
            </thead>
            <tbody>
              {recentGreenhouse.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-slate-500">No Greenhouse attempts yet</td></tr>
              ) : (
                recentGreenhouse.map((a) => (
                  <tr key={a.matchId} className="border-b border-slate-700/50">
                    <td className="py-2">{a.title}</td>
                    <td className="py-2">{a.company}</td>
                    <td className="py-2">{a.finalStatus}</td>
                    <td className="py-2 max-w-[240px] truncate text-slate-400" title={a.failureReason ?? ""}>{a.failureReason ?? "—"}</td>
                    <td className="py-2">{a.appliedAt ? new Date(a.appliedAt).toLocaleString() : "—"}</td>
                    <td className="py-2 text-center">{a.tailoredUsedInApply ? "Yes" : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
        <div className={`mt-4 rounded-ds-lg border px-4 py-3 ${liveReady ? "border-emerald-600/60 bg-emerald-900/20 text-emerald-200" : "border-amber-600/60 bg-amber-900/20 text-amber-200"}`}>
          {liveReady ? (
            <p><strong>Ready for live.</strong> No warnings.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1">
              {liveWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Provider performance (today)</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Per-provider attempted, applied, failed, needs_review, success rate.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="py-2 text-left font-medium">Provider</th>
                <th className="py-2 text-right">Attempted</th>
                <th className="py-2 text-right">Applied</th>
                <th className="py-2 text-right">Needs review</th>
                <th className="py-2 text-right">Skipped (URL)</th>
                <th className="py-2 text-right">Failed</th>
                <th className="py-2 text-right">Success rate</th>
              </tr>
            </thead>
            <tbody>
              {providerStats.map((s) => (
                <tr key={s.provider} className="border-b border-slate-700/50">
                  <td className="py-2">{s.provider}</td>
                  <td className="py-2 text-right">{s.attempted}</td>
                  <td className="py-2 text-right">{s.applied}</td>
                  <td className="py-2 text-right">{s.needs_review}</td>
                  <td className="py-2 text-right">{s.skipped_unsupported}</td>
                  <td className="py-2 text-right">{s.failed}</td>
                  <td className="py-2 text-right">{s.successRate != null ? `${s.successRate}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2">
          {providerStats.map((s) => (
            <p key={s.provider} className="text-ds-caption text-slate-400">
              <strong>{s.provider}:</strong> {getProviderHealthRecommendation(s)}
            </p>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Recent applications (last 50)</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Title, company, provider, status, failure reason, applied at, tailored used.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="py-2 text-left font-medium">Title</th>
                <th className="py-2 text-left">Company</th>
                <th className="py-2 text-left">Provider</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left max-w-[200px]">Failure reason</th>
                <th className="py-2 text-left">Applied at</th>
                <th className="py-2 text-center">Tailored</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-slate-500">No applications yet</td></tr>
              ) : (
                recentApps.map((a) => (
                  <tr key={a.matchId} className="border-b border-slate-700/50">
                    <td className="py-2">{a.title}</td>
                    <td className="py-2">{a.company}</td>
                    <td className="py-2">{a.provider}</td>
                    <td className="py-2">{a.finalStatus}</td>
                    <td className="py-2 max-w-[200px] truncate text-slate-400" title={a.failureReason ?? ""}>{a.failureReason ?? "—"}</td>
                    <td className="py-2">{a.appliedAt ? new Date(a.appliedAt).toLocaleString() : "—"}</td>
                    <td className="py-2 text-center">{a.tailoredUsedInApply ? "Yes" : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {workerNotRunning && (
        <div className="rounded-ds-lg border border-amber-600/60 bg-amber-900/20 px-4 py-3 text-amber-200">
          <strong>Auto-apply worker is not running.</strong> Start the worker with{" "}
          <code className="rounded bg-amber-900/40 px-1">npm run worker:auto-apply</code> or trigger one cycle below.
        </div>
      )}

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Operational checklist</h2>
        <p className="mt-1 text-ds-caption text-slate-500">
          Verify these before relying on automatic execution.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <span className={diagnostics.autoApplyEnabled ? "text-emerald-400" : "text-amber-400"}>
              {diagnostics.autoApplyEnabled ? "✓" : "✗"}
            </span>
            <span><strong>Live mode enabled</strong> — AUTO_APPLY_ENABLED = {String(diagnostics.autoApplyEnabled)}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={diagnostics.dryRunDefault ? "text-amber-400" : "text-emerald-400"}>
              {diagnostics.dryRunDefault ? "✓" : "✗"}
            </span>
            <span><strong>Dry run</strong> — DRY_RUN_DEFAULT = {String(diagnostics.dryRunDefault)} {diagnostics.dryRunDefault && "(no real applications)"}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={workerConfigured ? "text-emerald-400" : "text-slate-500"}>
              {workerConfigured ? "✓" : "—"}
            </span>
            <span><strong>Worker configured</strong> — {workerConfigured ? "Heartbeat present" : "No heartbeat yet (run a cycle or start worker)"}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span><strong>Supported URL</strong> — Only official apply URLs are used: Greenhouse (boards.greenhouse.io, grnh.se), Lever (jobs.lever.co), Workable (apply.workable.com). Custom career pages → skipped_unsupported.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={resumePath ? "text-emerald-400" : "text-amber-400"}>
              {resumePath ? "✓" : "✗"}
            </span>
            <span><strong>Resume path configured</strong> — {resumePath ? resumePath : "Set resumeFilePath in Profile for uploads"}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={telegram.telegramConfigured ? "text-emerald-400" : "text-amber-400"}>
              {telegram.telegramConfigured ? "✓" : "✗"}
            </span>
            <span><strong>Telegram configured</strong> — {telegram.telegramConfigured ? "Yes" : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for notifications"}</span>
          </li>
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
        <div className="mt-4 space-y-1 text-ds-caption text-slate-400">
          <p>
            Lock state:{" "}
            {lock
              ? `${lock.locked ? "locked" : "unlocked"}${
                  lock.lockedBy ? ` by ${lock.lockedBy}` : ""
                }`
              : "no lock document yet"}
          </p>
          <p>
            Last heartbeat:{" "}
            {lock?.heartbeatAt
              ? new Date(lock.heartbeatAt).toLocaleString()
              : "—"}
          </p>
          <p>
            Last run started:{" "}
            {metrics.lastAutoApplyRunStartedAt
              ? metrics.lastAutoApplyRunStartedAt.toLocaleString()
              : "—"}
          </p>
          <p>
            Last run completed:{" "}
            {metrics.lastAutoApplyRunCompletedAt
              ? metrics.lastAutoApplyRunCompletedAt.toLocaleString()
              : "—"}
          </p>
          <p>
            Last run status: {metrics.lastAutoApplyRunStatus ?? "—"}
          </p>
          {lock?.lastError && (
            <p className="text-amber-400">Last error: {lock.lastError}</p>
          )}
          {lock?.lastRunSummary && typeof lock.lastRunSummary === "object" && (
            <p>
              Last run summary: applied={(lock.lastRunSummary as Record<string, unknown>).applied ?? "—"} failed={(lock.lastRunSummary as Record<string, unknown>).failed ?? "—"} needs_review={(lock.lastRunSummary as Record<string, unknown>).needsReview ?? "—"}
            </p>
          )}
          <p>
            Worker heartbeat status:{" "}
            {metrics.lastAutoApplyHeartbeat
              ? `${metrics.lastAutoApplyHeartbeat.toLocaleString()}${
                  metrics.autoApplyWorkerStale ? " (stale)" : ""
                }`
              : "no heartbeat yet"}
          </p>
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

