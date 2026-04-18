import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TenantSwitcher } from "./TenantSwitcher";

export function SellerShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Seller Console
          </div>
          <div className="flex items-center gap-3">
            <TenantSwitcher />
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium">
              MS
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
