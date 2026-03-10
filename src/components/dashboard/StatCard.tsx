type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
};

export function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="glass-panel flex flex-col justify-between p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-white sm:text-3xl">{value}</p>
        {subtitle && (
          <p className="text-xs font-medium text-emerald-400/90">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
