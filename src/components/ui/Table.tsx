import { ReactNode } from "react";

const tableHeader =
  "px-5 py-3.5 text-left text-ds-caption font-medium text-slate-500";
const tableCell = "px-5 py-3.5 text-ds-body";
const tableRowHover = "transition hover:bg-slate-800/30";

type TableRootProps = {
  children: ReactNode;
  className?: string;
};

export function TableRoot({ children, className = "" }: TableRootProps) {
  return (
    <div
      className={`overflow-hidden rounded-ds-2xl border border-slate-800/60 bg-slate-900/40 shadow-card ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-ds-body">{children}</table>
      </div>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-800/60">{children}</tbody>;
}

export function TableHeaderRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-slate-800/80">{children}</tr>
  );
}

export function TableHeaderCell({
  children,
  align = "left"
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`${tableHeader} ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

export function TableRow({
  children,
  onClick,
  clickable
}: {
  children: ReactNode;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <tr
      className={`${tableRowHover} ${clickable || onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`${tableCell} ${className}`}>{children}</td>;
}
