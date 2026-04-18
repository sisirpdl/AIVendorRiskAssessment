import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  Building2,
  ListChecks,
  GitBranch,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const ITEMS: NavItem[] = [
  { to: "/seller", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/seller/upload", label: "Upload", icon: Upload },
  { to: "/seller/services", label: "Services", icon: Building2 },
  { to: "/seller/review", label: "Review Queue", icon: ListChecks },
  { to: "/seller/conflicts", label: "Conflicts", icon: GitBranch },
  { to: "/seller/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface/40 px-3 py-5">
      <div className="mb-6 px-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-elevated">
            <span className="h-2 w-2 rounded-full bg-signature shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
          </span>
          <span className="text-base font-semibold tracking-tight">Verifai</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5">
        {ITEMS.map((item) => {
          const active = item.exact ? path === item.to : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={item.to as any}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface text-foreground"
                  : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-signature shadow-[0_0_8px_rgba(250,204,21,0.7)]" />
              )}
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">Mock data</div>
        Backend wiring coming next. All values simulated.
      </div>
    </aside>
  );
}
