import { useTenant } from "@/context/TenantContext";
import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  signature: "bg-signature",
  verified: "bg-verified",
  warning: "bg-warning",
};

export function TenantSwitcher() {
  const { tenants, activeTenant, setActiveTenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!activeTenant) {
    return (
      <div className="h-9 w-44 animate-pulse rounded-lg border border-border bg-surface" />
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-sm transition-colors hover:border-border/80"
      >
        <span className={cn("h-2 w-2 rounded-full", DOT[activeTenant.color] ?? "bg-muted")} />
        <span className="font-medium">{activeTenant.name}</span>
        <span className="text-xs text-muted-foreground">{activeTenant.industry}</span>
        <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-card backdrop-blur-xl">
          <div className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Switch tenant
          </div>
          <ul className="p-1">
            {tenants.map((t) => {
              const isActive = t.id === activeTenant.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTenantId(t.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      isActive ? "bg-surface-elevated" : "hover:bg-surface-elevated",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", DOT[t.color] ?? "bg-muted")} />
                    <span className="flex-1 text-left">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{t.industry}</span>
                    </span>
                    {isActive && <Check className="h-3.5 w-3.5 text-signature" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
