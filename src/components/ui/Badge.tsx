import { ReactNode } from "react";

const variants: Record<string, string> = {
  default: "bg-slate-700/50 text-slate-300",
  neutral: "bg-slate-700/40 text-slate-400",
  "score-high": "bg-emerald-500/15 text-emerald-400",
  "score-mid": "bg-amber-500/15 text-amber-400",
  "score-low": "bg-slate-600/40 text-slate-400",
  source: "bg-slate-700/50 text-slate-300",
  "source-lever": "bg-violet-500/15 text-violet-300",
  "source-workable": "bg-amber-500/15 text-amber-300",
  status: "bg-slate-700/40 text-slate-400 capitalize",
};

type BadgeProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-ds-md px-2 py-0.5 text-ds-caption font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 70 ? "score-high" : score >= 50 ? "score-mid" : "score-low";
  return <Badge variant={variant as keyof typeof variants}>{score}</Badge>;
}
