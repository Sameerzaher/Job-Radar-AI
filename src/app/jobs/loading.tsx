export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 rounded bg-slate-800/80 animate-pulse" />
      <div className="h-16 rounded-ds-xl border border-slate-800 bg-slate-800/20 animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 rounded-ds-lg border border-slate-800 bg-slate-800/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
