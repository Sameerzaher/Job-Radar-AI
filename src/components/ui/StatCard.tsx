type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
};

export function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="ds-card group relative flex flex-col justify-between overflow-hidden transition hover:border-slate-700/60 hover:shadow-soft min-h-[120px]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-700/20" />
      <p className="text-ds-caption font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-ds-display font-semibold tracking-tight text-white">
          {value}
        </span>
        {subtitle && (
          <span className="text-ds-caption font-medium text-slate-500">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
