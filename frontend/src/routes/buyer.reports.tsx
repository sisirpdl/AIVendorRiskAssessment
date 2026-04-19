import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileSearch, Download, Loader2, ArrowRight, Building2, FileText } from "lucide-react";
import { BuyerShell } from "@/components/trustlens/BuyerShell";
import { ConfidenceRing } from "@/components/trustlens/ConfidenceRing";
import { useTenant } from "@/context/TenantContext";
import { getVendors, getDashboardStats } from "@/lib/api";
import type { Vendor } from "@/lib/types";
import { DOMAINS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Verifai Trust Vault" },
      {
        name: "description",
        content:
          "Exportable trust report cards, summarising posture across every service tracked for this tenant.",
      },
    ],
  }),
  component: ReportsPage,
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ReportsPage() {
  const { activeTenant } = useTenant();
  const [services, setServices] = useState<Vendor[] | null>(null);
  const [stats, setStats] = useState<{
    documents: number;
    vendors: number;
    pendingReviews: number;
    openConflicts: number;
  } | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    setServices(null);
    setStats(null);
    Promise.all([getVendors(activeTenant.id), getDashboardStats(activeTenant.id)]).then(
      ([v, s]) => {
        setServices(v);
        setStats(s);
      },
    );
  }, [activeTenant]);

  const summary = useMemo(() => {
    if (!services || services.length === 0) return null;
    const avg = Math.round(
      services.reduce((s, v) => s + v.overall_score, 0) / services.length,
    );
    const verified = services.filter((v) => v.overall_score >= 80).length;
    const atRisk = services.filter((v) => v.overall_score < 60).length;
    const weakestDomain = DOMAINS.reduce(
      (acc, d) => {
        const avgD = Math.round(
          services.reduce((s, v) => s + (v.domain_scores[d] ?? 0), 0) / services.length,
        );
        return avgD < acc.score ? { domain: d, score: avgD } : acc;
      },
      { domain: DOMAINS[0] as string, score: 100 },
    );
    return { avg, verified, atRisk, weakestDomain };
  }, [services]);

  const onExport = () => {
    // Simulated export — produce a quick summary blob
    const blob = new Blob(
      [
        JSON.stringify(
          { tenant: activeTenant?.name, services, generatedAt: new Date().toISOString() },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verifai-${activeTenant?.id}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BuyerShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Trust Vault
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Reports</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Exportable trust report cards summarising posture across every service.
            </p>
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={!services}
            className="inline-flex items-center gap-2 rounded-lg bg-signature px-4 py-2 text-sm font-medium text-signature-foreground shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export tenant report
          </button>
        </div>

        {/* Summary tiles */}
        {summary && stats && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <SummaryTile label="Average Posture" value={`${summary.avg}`} suffix="/100" tone="signature" />
            <SummaryTile label="Verified Services" value={`${summary.verified}`} tone="verified" />
            <SummaryTile label="At-Risk Services" value={`${summary.atRisk}`} tone="danger" />
            <SummaryTile label="Total Documents" value={`${stats.documents}`} tone="default" />
          </motion.div>
        )}

        {summary && (
          <div className="mb-8 rounded-2xl border border-warning/30 bg-warning/5 px-5 py-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-warning">
              Weakest domain across portfolio
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-base font-semibold">{summary.weakestDomain.domain}</span>
              <span className="font-mono-num text-sm text-warning">
                {summary.weakestDomain.score}/100
              </span>
            </div>
          </div>
        )}

        {!services ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating reports…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {services.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4) }}
              >
                <Link
                  to="/buyer/assess/$vendorId"
                  params={{ vendorId: s.id }}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-1 hover:border-signature/40"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-elevated font-mono-num text-sm font-semibold text-signature">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-base font-semibold tracking-tight">
                          {s.name}
                        </h3>
                        <FileSearch className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        Service report
                        <span>·</span>
                        <FileText className="h-3 w-3" />
                        {s.document_count} docs
                      </div>
                    </div>
                    <ConfidenceRing value={s.overall_score} size={60} strokeWidth={6} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    {DOMAINS.slice(0, 4).map((d) => {
                      const v = s.domain_scores[d] ?? 0;
                      return (
                        <div
                          key={d}
                          className="flex items-center justify-between rounded-md border border-border bg-surface-elevated/30 px-2.5 py-1.5"
                        >
                          <span className="truncate text-[10px] text-muted-foreground">
                            {d.split(" ")[0]}
                          </span>
                          <span
                            className={cn(
                              "font-mono-num font-semibold",
                              v >= 80
                                ? "text-verified"
                                : v >= 60
                                  ? "text-signature"
                                  : v >= 40
                                    ? "text-warning"
                                    : "text-danger",
                            )}
                          >
                            {v}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Generated {new Date().toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-signature opacity-0 transition-opacity group-hover:opacity-100">
                      Open report
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </BuyerShell>
  );
}

function SummaryTile({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: "default" | "signature" | "verified" | "danger";
}) {
  const toneCls =
    tone === "signature"
      ? "text-signature"
      : tone === "verified"
        ? "text-verified"
        : tone === "danger"
          ? "text-danger"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 font-mono-num text-2xl font-semibold", toneCls)}>
        {value}
        {suffix && <span className="ml-0.5 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
