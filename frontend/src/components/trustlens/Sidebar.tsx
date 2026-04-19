import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const ITEMS: NavItem[] = [
  { to: "/seller", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/seller/upload", label: "Upload", icon: Upload },
  { to: "/seller/review", label: "Review Queue", icon: ListChecks },
  { to: "/seller/conflicts", label: "Conflicts", icon: GitBranch },
];

export function Sidebar() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface/40 px-3 py-5">
      <div className="mb-6 px-3">
        <Link to="/">
          <Logo size="md" />
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
    </aside>
  );
}
