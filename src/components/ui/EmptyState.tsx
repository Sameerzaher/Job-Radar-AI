import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-ds-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-12 text-center shadow-card ${className}`}
    >
      <p className="text-ds-body text-slate-400">{title}</p>
      {description && (
        <p className="max-w-md text-ds-caption text-slate-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
