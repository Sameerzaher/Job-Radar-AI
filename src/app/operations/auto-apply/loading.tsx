export default function OperationsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-52 rounded bg-slate-800/80 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 rounded-ds-xl border border-slate-800 bg-slate-800/40 animate-pulse" />
        ))}
      </div>
      <div className="h-48 rounded-ds-xl border border-slate-800 bg-slate-800/20 animate-pulse" />
    </div>
  );
}
