import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, GitBranch, Clock, Loader2, ArrowRight, ShieldAlert } from "lucide-react";
import { BuyerShell } from "@/components/trustlens/BuyerShell";
import { useTenant } from "@/context/TenantContext";
import { getConflicts, getVendors } from "@/lib/mockApi";
import type { Conflict, Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — Verifai Trust Vault" },
      {
        name: "description",
        content:
          "Drift, conflicts, and posture changes across the services you depend on.",
      },
    ],
  }),
  component: AlertsPage,
});

interface Alert {
  id: string;
  kind: "conflict" | "drift" | "stale";
  severity: "high" | "medium" | "low";
  vendorId: string;
  vendorName: string;
  title: string;
  detail: string;
  ago: string;
}

function AlertsPage() {
  const { activeTenant } = useTenant();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    setAlerts(null);
    Promise.all([getConflicts(activeTenant.id), getVendors(activeTenant.id)]).then(
      ([conflicts, vendors]) => {
        setAlerts(buildAlerts(conflicts, vendors));
      },
    );
  }, [activeTenant]);

  return (
    <BuyerShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Trust Vault
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Alerts</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Drift, conflicts, and posture changes across the services you depend on.
            </p>
          </div>
          {alerts && (
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs sm:flex">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="font-mono-num text-foreground">{alerts.length}</span>
              <span className="text-muted-foreground">open alerts</span>
            </div>
          )}
        </div>

        {!alerts ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-12 text-center text-sm text-muted-foreground">
            All quiet. No open alerts.
          </div>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a, i) => {
              const palette = SEVERITY[a.severity];
              const Icon = KIND_ICON[a.kind];
              return (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link
                    to="/buyer/assess/$vendorId"
                    params={{ vendorId: a.vendorId }}
                    className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-signature/40"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        palette.iconBg,
                        palette.iconText,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", palette.chip)}>
                          {a.severity}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {a.vendorName} ┬╖ {a.kind}
                        </span>
                      </div>
                      <div className="text-sm font-semibold">{a.title}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {a.ago}
                      </div>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-signature" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </BuyerShell>
  );
}

const SEVERITY = {
  high: {
    chip: "border-danger/30 bg-danger/10 text-danger",
    iconBg: "bg-danger/10",
    iconText: "text-danger",
  },
  medium: {
    chip: "border-warning/30 bg-warning/10 text-warning",
    iconBg: "bg-warning/10",
    iconText: "text-warning",
  },
  low: {
    chip: "border-border bg-surface-elevated text-muted-foreground",
    iconBg: "bg-surface-elevated",
    iconText: "text-muted-foreground",
  },
};

const KIND_ICON = {
  conflict: GitBranch,
  drift: ShieldAlert,
  stale: Clock,
};

function buildAlerts(conflicts: Conflict[], vendors: Vendor[]): Alert[] {
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const fromConflicts: Alert[] = conflicts.map((c, i) => ({
    id: `c-${c.id}`,
    kind: "conflict",
    severity: i === 0 ? "high" : "medium",
    vendorId: c.vendor_id,
    vendorName: byId.get(c.vendor_id)?.name ?? "Service",
    title: c.question,
    detail: `Newer document contradicts a previously verified answer (╬ö ${Math.round(
      c.confidence_delta * 100,
    )}%).`,
    ago: `${(i + 1) * 3}h ago`,
  }));

  const fromDrift: Alert[] = vendors
    .filter((v) => v.overall_score < 70)
    .slice(0, 3)
    .map((v, i) => ({
      id: `d-${v.id}`,
      kind: "drift",
      severity: v.overall_score < 55 ? "high" : "medium",
      vendorId: v.id,
      vendorName: v.name,
      title: `${v.name} posture below acceptable threshold`,
      detail: `Overall trust score is ${v.overall_score}/100. Review failing domains.`,
      ago: `${(i + 1) * 8}h ago`,
    }));

  const fromStale: Alert[] = vendors
    .filter((v) => Date.now() - new Date(v.last_updated).getTime() > 7 * 86_400_000)
    .slice(0, 2)
    .map((v, i) => ({
      id: `s-${v.id}`,
      kind: "stale",
      severity: "low",
      vendorId: v.id,
      vendorName: v.name,
      title: `${v.name} evidence is aging`,
      detail: `No new trust documents in the last 7 days. Request a refresh.`,
      ago: `${(i + 1) * 24}h ago`,
    }));

  return [...fromConflicts, ...fromDrift, ...fromStale];
}
