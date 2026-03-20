import type { DashboardDayActivity } from "@/services/jobService";

type ActivityChartProps = {
  series: DashboardDayActivity[];
};

/** Bar chart for jobs added and applications per day (last 7 days). */
export function ActivityChart({ series }: ActivityChartProps) {
  const maxJobs = Math.max(1, ...series.map((d) => d.jobsAdded));
  const maxApplied = Math.max(1, ...series.map((d) => d.applied));

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 sm:p-5">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-ds-caption">
        <span className="flex items-center gap-2 text-slate-400">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500 shadow-sm" aria-hidden />
          New jobs
        </span>
        <span className="flex items-center gap-2 text-slate-400">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" aria-hidden />
          Applied
        </span>
      </div>

      {/* Chart rows */}
      <div className="space-y-3">
        {series.map((day, i) => (
          <div
            key={day.date}
            className={`flex items-center gap-3 sm:gap-4 ${i < series.length - 1 ? "pb-3 border-b border-slate-700/40" : ""}`}
          >
            <span className="w-16 shrink-0 text-ds-caption font-medium text-slate-300 tabular-nums">
              {day.label}
            </span>
            <div className="flex-1 grid grid-cols-2 gap-3 sm:gap-6">
              {/* New jobs bar */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 h-7 rounded-lg bg-slate-700/50 overflow-hidden min-w-[60px]">
                  <div
                    className="h-full rounded-lg bg-slate-500/90 transition-all duration-300 ease-out"
                    style={{
                      width: `${maxJobs ? Math.max(4, (day.jobsAdded / maxJobs) * 100) : 0}%`
                    }}
                  />
                </div>
                <span className="w-6 text-right text-ds-caption font-medium text-slate-300 tabular-nums shrink-0">
                  {day.jobsAdded}
                </span>
              </div>
              {/* Applied bar */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 h-7 rounded-lg bg-slate-700/50 overflow-hidden min-w-[60px]">
                  <div
                    className="h-full rounded-lg bg-emerald-500/90 transition-all duration-300 ease-out"
                    style={{
                      width: `${maxApplied ? Math.max(4, (day.applied / maxApplied) * 100) : 0}%`
                    }}
                  />
                </div>
                <span className="w-6 text-right text-ds-caption font-medium text-slate-300 tabular-nums shrink-0">
                  {day.applied}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
