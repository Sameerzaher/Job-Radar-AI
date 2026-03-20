"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SectionCard, Button } from "@/components/ui";

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

const AUTO_APPLY_OPTIONS = [
  { value: "", label: "Any" },
  { value: "true", label: "Auto-apply supported" },
  { value: "false", label: "Manual only" }
];

const SENIORITY_OPTIONS = [
  { value: "", label: "Any" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" }
];

const COMPANY_MEMORY_OPTIONS = [
  { value: "", label: "Any company" },
  { value: "has_prior", label: "With prior applications" },
  { value: "never_applied", label: "Never applied to" },
  { value: "on_cooldown", label: "On cooldown" }
];

export type SavedSearchItem = {
  _id?: string;
  name: string;
  filters: Record<string, string | number | boolean>;
};

type JobsFiltersProps = {
  sources: string[];
  initialMinScore?: string;
  initialSource?: string;
  initialStatus?: string;
  initialLocation?: string;
  initialSortBy?: string;
  initialAutoApply?: string;
  initialRemoteOnly?: boolean;
  initialSeniority?: string;
  initialCompanyMemory?: string;
  savedSearches?: SavedSearchItem[];
  saveSearchAction?: (name: string, filters: Record<string, string | number | boolean>) => Promise<void>;
  deleteSearchAction?: (searchId: string) => Promise<void>;
};

function buildParams(f: {
  minScore: string;
  source: string;
  status: string;
  location: string;
  sortBy: string;
  autoApply: string;
  remoteOnly: boolean;
  seniority: string;
  companyMemory: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (f.minScore) params.set("minScore", f.minScore);
  if (f.source) params.set("source", f.source);
  if (f.status) params.set("status", f.status);
  if (f.location) params.set("location", f.location);
  if (f.sortBy && f.sortBy !== "score-desc") params.set("sortBy", f.sortBy);
  if (f.autoApply) params.set("autoApply", f.autoApply);
  if (f.remoteOnly) params.set("remoteOnly", "true");
  if (f.seniority) params.set("seniority", f.seniority);
  if (f.companyMemory) params.set("companyMemory", f.companyMemory);
  return params;
}

function filtersToObject(f: {
  minScore: string;
  source: string;
  status: string;
  location: string;
  sortBy: string;
  autoApply: string;
  remoteOnly: boolean;
  seniority: string;
  companyMemory: string;
}): Record<string, string | number | boolean> {
  const o: Record<string, string | number | boolean> = {};
  if (f.minScore) o.minScore = f.minScore;
  if (f.source) o.source = f.source;
  if (f.status) o.status = f.status;
  if (f.location) o.location = f.location;
  if (f.sortBy) o.sortBy = f.sortBy;
  if (f.autoApply) o.autoApply = f.autoApply;
  if (f.remoteOnly) o.remoteOnly = true;
  if (f.seniority) o.seniority = f.seniority;
  if (f.companyMemory) o.companyMemory = f.companyMemory;
  return o;
}

export function JobsFilters({
  sources,
  initialMinScore,
  initialSource,
  initialStatus,
  initialLocation,
  initialSortBy = "score-desc",
  initialAutoApply = "",
  initialRemoteOnly = false,
  initialSeniority = "",
  initialCompanyMemory = "",
  savedSearches = [],
  saveSearchAction,
  deleteSearchAction
}: JobsFiltersProps) {
  const router = useRouter();
  const [minScore, setMinScore] = useState(initialMinScore ?? "");
  const [source, setSource] = useState(initialSource ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [autoApply, setAutoApply] = useState(initialAutoApply ?? "");
  const [remoteOnly, setRemoteOnly] = useState(initialRemoteOnly);
  const [seniority, setSeniority] = useState(initialSeniority ?? "");
  const [companyMemory, setCompanyMemory] = useState(initialCompanyMemory ?? "");

  const filterState = {
    minScore,
    source,
    status,
    location,
    sortBy,
    autoApply,
    remoteOnly,
    seniority,
    companyMemory
  };

  const apply = useCallback(() => {
    const params = buildParams(filterState);
    router.push(`/jobs?${params.toString()}`);
  }, [minScore, source, status, location, sortBy, autoApply, remoteOnly, seniority, companyMemory, router]);

  const clear = useCallback(() => {
    setMinScore("");
    setSource("");
    setStatus("");
    setLocation("");
    setSortBy("score-desc");
    setAutoApply("");
    setRemoteOnly(false);
    setSeniority("");
    setCompanyMemory("");
    router.push("/jobs");
  }, [router]);

  const loadSavedSearch = useCallback(
    (item: SavedSearchItem) => {
      const params = new URLSearchParams();
      const f = item.filters ?? {};
      Object.entries(f).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== false) params.set(k, String(v));
      });
      if (f.remoteOnly === true) params.set("remoteOnly", "true");
      router.push(`/jobs?${params.toString()}`);
    },
    [router]
  );

  const handleSaveSearch = useCallback(() => {
    const name = window.prompt("Name this search");
    if (!name?.trim() || !saveSearchAction) return;
    const filters = filtersToObject(filterState);
    saveSearchAction(name.trim(), filters);
  }, [minScore, source, status, location, sortBy, autoApply, remoteOnly, seniority, companyMemory, saveSearchAction]);

  const handleDeleteSearch = useCallback(
    (e: React.MouseEvent, searchId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleteSearchAction) deleteSearchAction(searchId);
    },
    [deleteSearchAction]
  );

  return (
    <SectionCard className="!py-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Min score</label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="ds-input w-20"
          />
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="ds-input"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ds-input"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Location</label>
          <input
            type="text"
            placeholder="e.g. Remote, Israel"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="ds-input min-w-[140px]"
          />
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="ds-input"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Apply</label>
          <select
            value={autoApply}
            onChange={(e) => setAutoApply(e.target.value)}
            className="ds-input"
          >
            {AUTO_APPLY_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Seniority</label>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
            className="ds-input"
          >
            {SENIORITY_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Company history</label>
          <select
            value={companyMemory}
            onChange={(e) => setCompanyMemory(e.target.value)}
            className="ds-input"
          >
            {COMPANY_MEMORY_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-ds-input-gap justify-end">
          <label className="text-ds-caption font-medium text-slate-500">Remote only</label>
          <div className="flex h-[38px] items-center">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-slate-100"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" size="md" onClick={apply}>
            Apply
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={clear}>
            Clear
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push("/jobs?source=Greenhouse&autoApply=true")}
            title="Source = Greenhouse, Auto-apply supported = true"
          >
            Greenhouse auto-apply
          </Button>
        </div>
      </div>
      {(savedSearches.length > 0 || saveSearchAction) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-700/60 pt-4">
          {savedSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ds-caption font-medium text-slate-500">Saved:</span>
              {savedSearches.map((s) => (
                <span
                  key={s._id ?? s.name}
                  className="inline-flex items-center gap-1 rounded-ds-lg border border-slate-600 bg-slate-800/40 px-2 py-1 text-ds-caption"
                >
                  <button
                    type="button"
                    onClick={() => loadSavedSearch(s)}
                    className="font-medium text-slate-200 hover:text-white"
                  >
                    {s.name}
                  </button>
                  {s._id && deleteSearchAction && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSearch(e, s._id!)}
                      className="text-slate-500 hover:text-red-400"
                      title="Delete saved search"
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {saveSearchAction && (
            <Button type="button" variant="secondary" size="md" onClick={handleSaveSearch}>
              Save current search
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
