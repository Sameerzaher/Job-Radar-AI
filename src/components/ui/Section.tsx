import { ReactNode } from "react";

type SectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Section({ title, description, children, className = "" }: SectionProps) {
  return (
    <section className={`space-y-ds-block ${className}`}>
      {(title || description) && (
        <div>
          {title && (
            <h2 className="text-ds-title font-semibold text-slate-100">{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-ds-body text-slate-500">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/** Card-style container: rounded, border, padding. Use for content blocks. */
export function SectionCard({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-ds-2xl border border-slate-800/60 bg-slate-900/40 px-ds-card py-ds-card shadow-card sm:px-ds-card-lg sm:py-ds-card-lg ${className}`}
    >
      {children}
    </div>
  );
}
