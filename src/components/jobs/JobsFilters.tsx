"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "new", label: "New" },
  { value: "interested", label: "Interested" },
  { value: "applied", label: "Applied" },
  { value: "saved", label: "Saved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" }
];

const SORT_OPTIONS = [
  { value: "score-desc", label: "Score (high first)" },
  { value: "score-asc", label: "Score (low first)" },
  { value: "newest", label: "Newest first" }
];

type JobsFiltersProps = {
  sources: string[];
  initialMinScore?: string;
  initialSource?: string;
  initialStatus?: string;
  initialLocation?: string;
  initialSortBy?: string;
};

export function JobsFilters({
  sources,
  initialMinScore,
  initialSource,
  initialStatus,
  initialLocation,
  initialSortBy = "score-desc"
}: JobsFiltersProps) {
  const router = useRouter();
  const [minScore, setMinScore] = useState(initialMinScore ?? "");
  const [source, setSource] = useState(initialSource ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [sortBy, setSortBy] = useState(initialSortBy);

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (minScore) params.set("minScore", minScore);
    if (source) params.set("source", source);
    if (status) params.set("status", status);
    if (location) params.set("location", location);
    if (sortBy && sortBy !== "score-desc") params.set("sortBy", sortBy);
    router.push(`/jobs?${params.toString()}`);
  }, [minScore, source, status, location, sortBy, router]);

  const clear = useCallback(() => {
    setMinScore("");
    setSource("");
    setStatus("");
    setLocation("");
    setSortBy("score-desc");
    router.push("/jobs");
  }, [router]);

  return (
    <div className="glass-panel p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Min score
          </label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="w-20 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Location
          </label>
          <input
            type="text"
            placeholder="e.g. Remote, Israel"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="min-w-[140px] rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Sort by
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800/60"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
