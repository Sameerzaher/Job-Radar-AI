import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/profile", label: "Profile" }
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white shadow-md"
          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-accent to-accent-soft text-xs font-semibold text-white shadow-soft">
              JR
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">
                Job Radar AI
              </p>
              <p className="text-xs text-slate-400">
                Smart radar for your next role
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-full bg-slate-900/60 p-1">
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-1 px-4 pb-8 pt-6">
        <div className="w-full space-y-6">{children}</div>
      </main>
    </div>
  );
}
