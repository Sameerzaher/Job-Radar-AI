"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

type Props = {
  currentStatus?: string;
  currentReason?: string;
  currentProvider?: string;
  currentCompany?: string;
  currentAutoApply?: string;
};

export function ReviewQueueFilters({
  currentStatus,
  currentReason,
  currentProvider,
  currentCompany,
  currentAutoApply
}: Props) {
  const router = useRouter();
  const companyInputRef = useRef<HTMLInputElement>(null);

  function buildUrl(updates: { status?: string; reason?: string; provider?: string; company?: string; autoApply?: string }): string {
    const p = new URLSearchParams();
    const status = updates.status ?? currentStatus;
    const reason = updates.reason ?? currentReason;
    const provider = updates.provider ?? currentProvider;
    const company = updates.company ?? currentCompany;
    const autoApply = updates.autoApply ?? currentAutoApply;
    if (status) p.set("status", status);
    if (reason) p.set("reason", reason);
    if (provider) p.set("provider", provider);
    if (company) p.set("company", company);
    if (autoApply) p.set("autoApply", autoApply);
    const q = p.toString();
    return q ? `/review?${q}` : "/review";
  }

  const base = "rounded-ds-lg border px-3 py-1.5 text-ds-caption font-medium transition-colors";
  const active = "border-sky-500 bg-sky-900/40 text-sky-200";
  const inactive = "border-slate-600 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ds-caption text-slate-500">Filter:</span>
      <Link
        href="/review"
        className={`${base} ${!currentStatus && !currentReason && !currentProvider && !currentCompany && !currentAutoApply ? active : inactive}`}
      >
        All
      </Link>
      <Link
        href={buildUrl({ autoApply: "true" })}
        className={`${base} ${currentAutoApply === "true" ? active : inactive}`}
      >
        Auto-apply supported
      </Link>
      <Link
        href={buildUrl({ autoApply: "false" })}
        className={`${base} ${currentAutoApply === "false" ? active : inactive}`}
      >
        Manual only
      </Link>
      <Link
        href={buildUrl({ status: "skipped_rules" })}
        className={`${base} ${currentStatus === "skipped_rules" ? active : inactive}`}
      >
        Rule blocked
      </Link>
      <Link
        href={buildUrl({ reason: "cooldown" })}
        className={`${base} ${currentReason === "cooldown" ? active : inactive}`}
      >
        Company cooldown
      </Link>
      <Link
        href={buildUrl({ reason: "Location" })}
        className={`${base} ${currentReason === "Location" ? active : inactive}`}
      >
        Location mismatch
      </Link>
      <Link
        href={buildUrl({ reason: "missing" })}
        className={`${base} ${currentReason === "missing" ? active : inactive}`}
      >
        Missing skills
      </Link>
      <Link
        href={buildUrl({ status: "skipped_unsupported" })}
        className={`${base} ${currentStatus === "skipped_unsupported" ? active : inactive}`}
      >
        Unsupported URL
      </Link>
      <Link
        href={buildUrl({ status: "queued,approved" })}
        className={`${base} ${currentStatus === "queued,approved" ? active : inactive}`}
      >
        Auto-apply ready
      </Link>
      <span className="text-ds-caption text-slate-500">Provider:</span>
      <Link
        href={buildUrl({ provider: "Greenhouse" })}
        className={`${base} ${currentProvider === "Greenhouse" ? active : inactive}`}
      >
        Greenhouse
      </Link>
      <Link
        href={buildUrl({ provider: "Lever" })}
        className={`${base} ${currentProvider === "Lever" ? active : inactive}`}
      >
        Lever
      </Link>
      <Link
        href={buildUrl({ provider: "Workable" })}
        className={`${base} ${currentProvider === "Workable" ? active : inactive}`}
      >
        Workable
      </Link>
      <form
        className="inline-flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const v = companyInputRef.current?.value?.trim();
          router.push(v ? buildUrl({ company: v }) : "/review");
        }}
      >
        <input
          ref={companyInputRef}
          type="text"
          placeholder="Company name"
          defaultValue={currentCompany}
          className="rounded-ds-lg border border-slate-600 bg-slate-800/40 px-2 py-1 text-ds-caption text-slate-200 placeholder:text-slate-500"
        />
        <button type="submit" className={`${base} ${inactive}`}>
          Company
        </button>
      </form>
    </div>
  );
}
