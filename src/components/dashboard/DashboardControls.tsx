"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard, Button } from "@/components/ui";

export function DashboardControls() {
  const router = useRouter();
  const [loading, setLoading] = useState<"sync" | "apply" | "dryrun" | "retry" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function triggerSync() {
    setLoading("sync");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Sync: ${data.jobsInserted ?? 0} inserted` });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error ?? data.detail ?? "Sync failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(null);
    }
  }

  async function triggerAutoApply(dryRun: boolean) {
    setLoading(dryRun ? "dryrun" : "apply");
    setMessage(null);
    try {
      const res = await fetch("/api/apply/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, maxApplications: 10 })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: dryRun
            ? `Dry run: ${data.applied ?? 0} would apply`
            : `Apply: ${data.applied ?? 0} applied, ${data.failed ?? 0} failed`
        });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error ?? data.detail ?? "Apply failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(null);
    }
  }

  async function triggerRetryFailed() {
    setLoading("retry");
    setMessage(null);
    try {
      const res = await fetch("/api/apply/retry", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Queued ${data.queued ?? 0} for retry` });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error ?? "Retry failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <SectionCard>
      <h2 className="text-ds-title font-semibold text-slate-100">Manual controls</h2>
      <p className="mt-1 text-ds-caption text-slate-500">
        Trigger sync, auto-apply, or retry failed applications.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={triggerSync}
          disabled={!!loading}
        >
          {loading === "sync" ? "Syncing…" : "Sync all"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => triggerAutoApply(false)}
          disabled={!!loading}
        >
          {loading === "apply" ? "Applying…" : "Auto apply"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => triggerAutoApply(true)}
          disabled={!!loading}
        >
          {loading === "dryrun" ? "Running…" : "Dry run apply"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={triggerRetryFailed}
          disabled={!!loading}
        >
          {loading === "retry" ? "Retrying…" : "Retry failed"}
        </Button>
      </div>
      {message && (
        <p className={`mt-2 text-ds-caption ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </SectionCard>
  );
}
