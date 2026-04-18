import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShieldCheck,
  Building2,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
} from "lucide-react";
import { BuyerShell } from "@/components/trustlens/BuyerShell";
import { ConfidenceRing } from "@/components/trustlens/ConfidenceRing";
import { useTenant } from "@/context/TenantContext";
import { getVendors } from "@/lib/api";
import { getImports, importedVendorToVendor, isImportedVendorId, removeImport, tokenFromImportedId } from "@/lib/imports";
import { DOMAINS } from "@/lib/types";
import type { Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer")({
  head: () => ({
    meta: [
      { title: "Trust Vault — Verifai" },
      {
        name: "description",
        content:
          "Audit services with verified posture, confidence scores, and PDF-grounded evidence.",
      },
      { property: "og:title", content: "Trust Vault — Verifai" },
      {
        property: "og:description",
        content: "Buyer-side trust vault with verified service posture and evidence.",
      },
    ],
  }),
  component: BuyerVault,
});

// Domain initials for compact bar labels
const DOMAIN_SHORT: Record<string, string> = {
  "Access Control & Identity": "AC",
  "Data Security & Encryption": "DS",
  "Incident Response": "IR",
  "Business Continuity": "BC",
  "Vulnerability Management": "VM",
  "Compliance & Audit": "CA",
  "Vendor & Supply Chain": "VS",
  "Infrastructure & Ops": "IO",
};

function scoreTone(score: number) {
  if (score >= 80) return { bar: "bg-verified", text: "text-verified", chip: "bg-verified/10 text-verified border-verified/30" };
  if (score >= 60) return { bar: "bg-signature", text: "text-signature", chip: "bg-signature/10 text-signature border-signature/40" };
  if (score >= 40) return { bar: "bg-warning", text: "text-warning", chip: "bg-warning/10 text-warning border-warning/30" };
  return { bar: "bg-danger", text: "text-danger", chip: "bg-danger/10 text-danger border-danger/30" };
}

function statusIcon(score: number) {
  if (score >= 80) return CheckCircle2;
  if (score >= 60) return ShieldCheck;
  if (score >= 40) return AlertTriangle;
  return XCircle;
}

function vendorInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const VENDOR_TINTS = [
  "from-signature/30 to-signature/5 text-signature",
  "from-verified/30 to-verified/5 text-verified",
  "from-warning/30 to-warning/5 text-warning",
  "from-danger/30 to-danger/5 text-danger",
  "from-foreground/20 to-foreground/5 text-foreground",
];

function BuyerVault() {
  const { activeTenant } = useTenant();
  return (
    <BuyerShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Header tenantName={activeTenant?.name} industry={activeTenant?.industry} />
        <VendorGrid tenantId={activeTenant?.id} />
      </div>
    </BuyerShell>
  );
}

function Header({ tenantName, industry }: { tenantName?: string; industry?: string }) {
  return (
    <div className="mb-8">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Trust Vault
      </div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {tenantName ?? "—"}
        {industry && (
          <span className="ml-3 align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {industry}
          </span>
        )}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Every service score is grounded in source PDFs with bounding-box evidence.
        No hallucinations.
      </p>
    </div>
  );
}

type DomainFilter = "all" | (typeof DOMAINS)[number];

function VendorGrid({ tenantId }: { tenantId?: string }) {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<DomainFilter>("all");

  useEffect(() => {
    if (!tenantId) return;
    setVendors(null);
    getVendors(tenantId).then((remote) => {
      const imports = getImports(tenantId).map((i) => importedVendorToVendor(i, tenantId));
      setVendors([...imports, ...remote]);
    });
  }, [tenantId]);

  const filtered = useMemo(() => {
    if (!vendors) return null;
    return vendors
      .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (domain === "all") return b.overall_score - a.overall_score;
        return (b.domain_scores[domain] ?? 0) - (a.domain_scores[domain] ?? 0);
      });
  }, [vendors, query, domain]);

  const summary = useMemo(() => {
    if (!vendors || vendors.length === 0) return null;
    const avg = Math.round(
      vendors.reduce((s, v) => s + v.overall_score, 0) / vendors.length,
    );
    const verified = vendors.filter((v) => v.overall_score >= 80).length;
    const review = vendors.filter((v) => v.overall_score < 60).length;
    return { avg, verified, review, total: vendors.length };
  }, [vendors]);

  return (
    <>
      {/* Summary strip */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <SummaryStat label="Services Tracked" value={summary.total} accent="default" />
          <SummaryStat label="Verified ≥80" value={summary.verified} accent="verified" />
          <SummaryStat label="Needs Review" value={summary.review} accent="warning" />
          <SummaryStat label="Avg Score" value={summary.avg} accent="signature" suffix="/100" />
        </motion.div>
      )}

      {/* Search + filters */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-signature/60 focus:ring-2 focus:ring-signature/20"
          />
        </div>

        <div className="-mx-1 flex flex-wrap items-center gap-1.5 overflow-x-auto px-1">
          <FilterChip
            active={domain === "all"}
            onClick={() => setDomain("all")}
            label="All Domains"
          />
          {DOMAINS.map((d) => (
            <FilterChip
              key={d}
              active={domain === d}
              onClick={() => setDomain(d)}
              label={d}
            />
          ))}
        </div>
      </div>

      {/* Grid */}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((v, i) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
              >
                <VendorCard
                  vendor={v}
                  highlightDomain={domain === "all" ? null : domain}
                  index={i}
                  onRemoveImport={(vendorId) => {
                    if (!tenantId) return;
                    const token = tokenFromImportedId(vendorId);
                    if (!token) return;
                    removeImport(tenantId, token);
                    setVendors((prev) => (prev ? prev.filter((x) => x.id !== vendorId) : prev));
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

function SummaryStat({
  label,
  value,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  accent: "default" | "verified" | "warning" | "signature";
  suffix?: string;
}) {
  const tone =
    accent === "verified"
      ? "text-verified"
      : accent === "warning"
        ? "text-warning"
        : accent === "signature"
          ? "text-signature"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 font-mono-num text-2xl font-semibold", tone)}>
        {value}
        {suffix && <span className="ml-0.5 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? "border-signature/60 bg-signature/10 text-signature shadow-[0_0_0_1px_rgba(250,204,21,0.2)]"
          : "border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function VendorCard({
  vendor,
  highlightDomain,
  index,
  onRemoveImport,
}: {
  vendor: Vendor;
  highlightDomain: string | null;
  index: number;
  onRemoveImport?: (vendorId: string) => void;
}) {
  const tone = scoreTone(vendor.overall_score);
  const StatusIcon = statusIcon(vendor.overall_score);
  const tint = VENDOR_TINTS[index % VENDOR_TINTS.length];
  const lastUpdated = new Date(vendor.last_updated);
  const daysAgo = Math.max(
    1,
    Math.round((Date.now() - lastUpdated.getTime()) / 86_400_000),
  );

  const isImported = isImportedVendorId(vendor.id);
  const shareToken = tokenFromImportedId(vendor.id);
  const cardClasses =
    "group relative flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-signature/50 hover:shadow-[0_0_0_1px_rgba(250,204,21,0.2),0_18px_50px_-20px_rgba(250,204,21,0.3)]";

  const body = (
    <>
      {isImported && onRemoveImport && (
        <button
          type="button"
          aria-label="Remove imported vendor"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveImport(vendor.id);
          }}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground opacity-0 transition-all hover:border-danger/40 hover:text-danger group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Top row: logo + identity + ring */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-mono-num text-sm font-semibold",
            tint,
          )}
        >
          {vendorInitials(vendor.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-semibold tracking-tight">
              {vendor.name}
            </h3>
            <StatusIcon className={cn("h-3.5 w-3.5", tone.text)} />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>{vendor.document_count} documents</span>
            <span>·</span>
            <span>Updated {daysAgo}d ago</span>
          </div>
        </div>
        <ConfidenceRing value={vendor.overall_score} size={68} strokeWidth={6} />
      </div>

      {/* Domain bars */}
      <div className="mt-5 space-y-1.5">
        {DOMAINS.map((d) => {
          const score = vendor.domain_scores[d] ?? 0;
          const t = scoreTone(score);
          const isHighlighted = highlightDomain === d;
          return (
            <div
              key={d}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-1.5 py-0.5 transition-colors",
                isHighlighted && "bg-signature/5",
              )}
            >
              <span
                className={cn(
                  "w-6 shrink-0 font-mono-num text-[10px] font-medium uppercase tracking-wider",
                  isHighlighted ? "text-signature" : "text-muted-foreground",
                )}
              >
                {DOMAIN_SHORT[d]}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                  className={cn("h-full rounded-full", t.bar)}
                  style={
                    isHighlighted
                      ? { boxShadow: "0 0 8px currentColor" }
                      : undefined
                  }
                />
              </div>
              <span
                className={cn(
                  "w-7 shrink-0 text-right font-mono-num text-[11px] font-medium",
                  t.text,
                )}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
        {isImported ? (
          <span className="rounded-md border border-signature/30 bg-signature/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-signature">
            Imported
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 text-xs font-medium text-signature opacity-0 transition-opacity group-hover:opacity-100">
          Open assessment
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </>
  );

  if (isImported && shareToken) {
    return (
      <Link to="/share/$token" params={{ token: shareToken }} className={cardClasses}>
        {body}
      </Link>
    );
  }

  return (
    <Link to="/buyer/assess/$vendorId" params={{ vendorId: vendor.id }} className={cardClasses}>
      {body}
    </Link>
  );
}
