export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 rounded bg-slate-800/80 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-ds-xl border border-slate-800 bg-slate-800/40 animate-pulse" />
        ))}
      </div>
      <div className="h-32 rounded-ds-xl border border-slate-800 bg-slate-800/20 animate-pulse" />
      <div className="h-40 rounded-ds-xl border border-slate-800 bg-slate-800/20 animate-pulse" />
    </div>
  );
}
