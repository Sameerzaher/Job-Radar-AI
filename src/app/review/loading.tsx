export default function ReviewLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 rounded bg-slate-800/80 animate-pulse" />
      <div className="h-14 rounded-ds-xl border border-slate-800 bg-slate-800/20 animate-pulse" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-ds-lg border border-slate-800 bg-slate-800/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
