import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Building2, ListChecks, GitBranch, ArrowRight, Loader2 } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { StatCard } from "@/components/trustlens/StatCard";
import { useTenant } from "@/context/TenantContext";
import { getDashboardStats, getDocuments } from "@/lib/mockApi";
import type { TrustDocument } from "@/lib/types";

export const Route = createFileRoute("/seller/")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — Verifai" },
      {
        name: "description",
        content:
          "Review documents, vendors, pending answers, and conflict resolutions in one MSP console.",
      },
    ],
  }),
  component: SellerDashboard,
});

function SellerDashboard() {
  const { activeTenant } = useTenant();
  return (
    <SellerShell>
      <div className="px-8 py-7">
        <Header tenantName={activeTenant?.name} />
        <Stats tenantId={activeTenant?.id} />
        <RecentDocuments tenantId={activeTenant?.id} />
      </div>
    </SellerShell>
  );
}

function Header({ tenantName }: { tenantName?: string }) {
  return (
    <div className="mb-7">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {tenantName ?? "—"}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review AI-generated answers and publish them as verified responses.
      </p>
    </div>
  );
}

function Stats({ tenantId }: { tenantId?: string }) {
  const [stats, setStats] = useState<{
    documents: number;
    vendors: number;
    pendingReviews: number;
    openConflicts: number;
  } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setStats(null);
    getDashboardStats(tenantId).then(setStats);
  }, [tenantId]);

  const items = stats
    ? [
        { title: "Total Documents", value: stats.documents, icon: <FileText className="h-4 w-4" />, accent: "default" as const },
        { title: "Active Services", value: stats.vendors, icon: <Building2 className="h-4 w-4" />, accent: "default" as const },
        { title: "Pending Reviews", value: stats.pendingReviews, icon: <ListChecks className="h-4 w-4" />, accent: "warning" as const },
        { title: "Open Conflicts", value: stats.openConflicts, icon: <GitBranch className="h-4 w-4" />, accent: "danger" as const },
      ]
    : Array.from({ length: 4 }, (_, i) => ({ title: "", value: 0, icon: null, accent: "default" as const, key: i }));

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats
        ? items.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <StatCard title={it.title} value={it.value} icon={it.icon} accent={it.accent} />
            </motion.div>
          ))
        : Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[110px] animate-pulse rounded-xl border border-border bg-surface/60"
            />
          ))}
    </div>
  );
}

const STATUS_CHIP: Record<TrustDocument["status"], string> = {
  ready: "bg-verified/10 text-verified border-verified/30",
  processing: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-danger/10 text-danger border-danger/30",
};

function RecentDocuments({ tenantId }: { tenantId?: string }) {
  const router = useRouter();
  const [docs, setDocs] = useState<TrustDocument[] | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setDocs(null);
    getDocuments(tenantId).then(setDocs);
  }, [tenantId]);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Recent Documents</h2>
        <Link to="/seller/upload" className="text-xs font-medium text-signature hover:underline">
          Upload new →
        </Link>
      </div>

      {!docs ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading documents…
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.slice(0, 8).map((d, i) => (
            <motion.li
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="card-hover group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 hover:border-border/80"
              onClick={() =>
                router.navigate({
                  to: "/seller/review/$docId",
                  params: { docId: d.id },
                })
              }
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-signature">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.filename}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{d.vendor_name}</span>
                  <span>·</span>
                  <span className="font-mono-num">{d.pages} pages</span>
                  <span>·</span>
                  <span>{new Date(d.uploaded_at).toLocaleDateString()}</span>
                </div>
              </div>
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CHIP[d.status]}`}
              >
                {d.status}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-signature opacity-0 transition-opacity group-hover:opacity-100">
                Review
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
