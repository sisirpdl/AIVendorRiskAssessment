import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { ConfidenceBar } from "@/components/trustlens/ConfidenceBar";
import { IDKBadge } from "@/components/trustlens/IDKBadge";
import { useTenant } from "@/context/TenantContext";
import { getDocuments, getAnswers } from "@/lib/mockApi";
import type { QueryAnswer, TrustDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/review/")({
  head: () => ({
    meta: [
      { title: "Review Queue ΓÇö Verifai" },
      {
        name: "description",
        content:
          "Every AI-generated answer awaiting human verification across all services and documents.",
      },
    ],
  }),
  component: ReviewQueuePage,
});

type Filter = "all" | "pending" | "idk" | "verified";

interface QueueRow {
  answer: QueryAnswer;
  doc: TrustDocument;
}

function ReviewQueuePage() {
  const { activeTenant } = useTenant();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  useEffect(() => {
    if (!activeTenant) return;
    let cancelled = false;
    setRows(null);
    (async () => {
      const docs = await getDocuments(activeTenant.id);
      const lists = await Promise.all(
        docs.map(async (d) => {
          const ans = await getAnswers(d.vendor_id);
          return ans.map((a) => ({ answer: a, doc: d }));
        }),
      );
      if (cancelled) return;
      // Dedupe ΓÇö answers are vendor-scoped, so picking first doc per vendor is enough
      const seen = new Set<string>();
      const merged: QueueRow[] = [];
      lists.flat().forEach((r) => {
        const key = `${r.doc.vendor_id}-${r.answer.question_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(r);
        }
      });
      setRows(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenant]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (filter === "all") return rows;
    if (filter === "idk") return rows.filter((r) => r.answer.idk);
    if (filter === "verified") return rows.filter((r) => r.answer.status === "verified");
    return rows.filter((r) => r.answer.status === "pending_review" && !r.answer.idk);
  }, [rows, filter]);

  const counts = useMemo(() => {
    if (!rows) return null;
    return {
      all: rows.length,
      pending: rows.filter((r) => r.answer.status === "pending_review" && !r.answer.idk).length,
      idk: rows.filter((r) => r.answer.idk).length,
      verified: rows.filter((r) => r.answer.status === "verified").length,
    };
  }, [rows]);

  return (
    <SellerShell>
      <div className="px-8 py-7">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {activeTenant?.name ?? "ΓÇö"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Review queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every AI-generated answer that needs a human eye before publishing.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs sm:flex">
            <ListChecks className="h-3.5 w-3.5 text-signature" />
            <span className="font-mono-num text-foreground">
              {counts?.pending ?? "ΓÇö"}
            </span>
            <span className="text-muted-foreground">awaiting review</span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "pending", label: "Pending" },
              { key: "idk", label: "Information Not Found" },
              { key: "verified", label: "Verified" },
              { key: "all", label: "All" },
            ] as { key: Filter; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                filter === f.key
                  ? "border-signature/60 bg-signature/10 text-signature"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {counts && (
                <span className="ml-2 font-mono-num text-[10px] opacity-70">
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {!filtered ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading queueΓÇª
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-12 text-center text-sm text-muted-foreground">
            Queue is empty. Nice work.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.slice(0, 30).map((r, i) => (
              <motion.li
                key={`${r.doc.id}-${r.answer.question_id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
              >
                <Link
                  to="/seller/review/$docId"
                  params={{ docId: r.doc.id }}
                  className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-signature/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-signature">
                    {r.answer.idk ? (
                      <AlertCircle className="h-4 w-4 text-idk" />
                    ) : (
                      <ListChecks className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {r.answer.domain}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {r.doc.vendor_name} ┬╖ {r.doc.filename}
                      </span>
                    </div>
                    <div className="text-sm font-medium leading-snug">
                      {r.answer.question}
                    </div>
                    <div className="mt-2 max-w-2xl">
                      {r.answer.idk ? (
                        <IDKBadge />
                      ) : (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {r.answer.answer}
                        </p>
                      )}
                    </div>
                    {!r.answer.idk && (
                      <div className="mt-2 max-w-xs">
                        <ConfidenceBar value={r.answer.confidence} />
                      </div>
                    )}
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-signature" />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </SellerShell>
  );
}
