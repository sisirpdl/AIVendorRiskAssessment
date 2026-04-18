import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Building2, FileText, ArrowRight, Loader2 } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { ConfidenceRing } from "@/components/trustlens/ConfidenceRing";
import { useTenant } from "@/context/TenantContext";
import { getVendors } from "@/lib/api";
import type { Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/services")({
  head: () => ({
    meta: [
      { title: "Services — Verifai" },
      {
        name: "description",
        content:
          "All third-party services tracked for this tenant, with overall trust scores and document counts.",
      },
    ],
  }),
  component: ServicesPage,
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

function ServicesPage() {
  const { activeTenant } = useTenant();
  const [services, setServices] = useState<Vendor[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeTenant) return;
    setServices(null);
    getVendors(activeTenant.id).then(setServices);
  }, [activeTenant]);

  const filtered = useMemo(() => {
    if (!services) return null;
    return services
      .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.overall_score - a.overall_score);
  }, [services, query]);

  return (
    <SellerShell>
      <div className="px-8 py-7">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {activeTenant?.name ?? "—"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Services</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Third-party services tracked for this tenant. Click a service to view its
              documents and answers.
            </p>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-signature/60 focus:ring-2 focus:ring-signature/20"
            />
          </div>
        </div>

        {!filtered ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading services…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-12 text-center text-sm text-muted-foreground">
            No services match your filter.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s, i) => {
              const tone =
                s.overall_score >= 80
                  ? "text-verified"
                  : s.overall_score >= 60
                    ? "text-signature"
                    : s.overall_score >= 40
                      ? "text-warning"
                      : "text-danger";
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link
                    to="/buyer/assess/$vendorId"
                    params={{ vendorId: s.id }}
                    className="group flex h-full items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-signature/40"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-elevated font-mono-num text-sm font-semibold text-signature">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold tracking-tight">
                        {s.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>{s.document_count} documents</span>
                        <span>·</span>
                        <Building2 className="h-3 w-3" />
                        <span>Service</span>
                      </div>
                    </div>
                    <ConfidenceRing value={s.overall_score} size={52} strokeWidth={5} />
                    <ArrowRight
                      className={cn(
                        "h-4 w-4 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100",
                        tone,
                      )}
                    />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </SellerShell>
  );
}
