/** Shown immediately when navigating between pages – improves perceived speed. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded bg-slate-800/80 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-ds-xl border border-slate-800 bg-slate-800/40 animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-ds-xl border border-slate-800 bg-slate-800/20 animate-pulse" />
      <div className="flex items-center justify-center py-12 text-slate-500">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-slate-400" />
        <span className="ml-2 text-sm">Loading…</span>
      </div>
    </div>
  );
}
