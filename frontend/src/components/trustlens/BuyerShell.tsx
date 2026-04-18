import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ShieldCheck, LayoutGrid, AlertTriangle, FileSearch } from "lucide-react";
import { TenantSwitcher } from "./TenantSwitcher";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/buyer", label: "Trust Vault", icon: LayoutGrid, exact: true },
  { to: "/buyer/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/buyer/reports", label: "Reports", icon: FileSearch },
];

export function BuyerShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-elevated">
                <ShieldCheck className="h-3.5 w-3.5 text-signature" />
              </span>
              <span className="text-base font-semibold tracking-tight">Verifai</span>
              <span className="ml-1 hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
                Buyer
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => {
                const active = item.exact ? path === item.to : path.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={item.to as any}
                    className={cn(
                      "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-surface text-foreground"
                        : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-signature shadow-[0_0_8px_rgba(250,204,21,0.7)]" />
                    )}
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <TenantSwitcher />
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium">
              AU
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
