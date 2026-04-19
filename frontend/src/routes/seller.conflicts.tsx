import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Loader2, Check, X, AlertTriangle, TrendingDown, HelpCircle } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { useTenant } from "@/context/TenantContext";
import { getConflicts, resolveConflict } from "@/lib/api";
import type { Conflict, ConflictSeverity, ConflictStatus, ConflictType, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflicts — Verifai" },
      {
        name: "description",
        content:
          "Where the latest document contradicts a previously verified answer. Resolve by accepting the newer or older evidence.",
      },
    ],
  }),
  component: ConflictsPage,
});

const TYPE_LABELS: Record<ConflictType, string> = {
  idk_flip: "IDK flip",
  keyword_flip: "Verdict flip",
  confidence_drop: "Confidence drop",
  semantic: "Semantic drift",
};

const TYPE_ICONS: Record<ConflictType, typeof HelpCircle> = {
  idk_flip: HelpCircle,
  keyword_flip: AlertTriangle,
  confidence_drop: TrendingDown,
  semantic: AlertTriangle,
};

const SEVERITY_CLASSES: Record<ConflictSeverity, string> = {
  high: "border-danger/30 bg-danger/10 text-danger",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
};

const VERDICT_CLASSES: Record<Verdict, string> = {
  YES: "border-verified/30 bg-verified/10 text-verified",
  NO: "border-danger/30 bg-danger/10 text-danger",
  N_A: "border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
};

function ConflictsPage() {
  const { activeTenant } = useTenant();
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeTenant) return;
    setConflicts(null);
    getConflicts(activeTenant.id).then(setConflicts).catch(() => setConflicts([]));
  }, [activeTenant]);

  const resolve = async (id: string, choice: ConflictStatus) => {
    if (!activeTenant) return;
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await resolveConflict(id, activeTenant.id, choice);
      setConflicts((curr) =>
        curr ? curr.map((c) => (c.id === id ? { ...c, status: choice } : c)) : curr,
      );
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  const unresolved = conflicts?.filter((c) => c.status === "unresolved").length ?? 0;

  return (
    <SellerShell>
      <div className="px-8 py-7">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {activeTenant?.name ?? "—"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conflicts</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              When a new upload contradicts a previously verified answer, Verifai surfaces
              both sides. Pick the source of truth — accepting the old answer restores it
              on the exported questionnaire.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs sm:flex">
            <GitBranch className="h-3.5 w-3.5 text-danger" />
            <span className="font-mono-num text-foreground">{conflicts ? unresolved : "—"}</span>
            <span className="text-muted-foreground">unresolved</span>
          </div>
        </div>

        {!conflicts ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading conflicts…
          </div>
        ) : conflicts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-12 text-center text-sm text-muted-foreground">
            No conflicts detected. Upload a new version of an existing vendor's document
            to see drift flagged here.
          </div>
        ) : (
          <ul className="space-y-4">
            <AnimatePresence>
              {conflicts.map((c, i) => (
                <ConflictCard
                  key={c.id}
                  conflict={c}
                  index={i}
                  pending={!!pending[c.id]}
                  onResolve={resolve}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </SellerShell>
  );
}

function ConflictCard({
  conflict: c,
  index,
  pending,
  onResolve,
}: {
  conflict: Conflict;
  index: number;
  pending: boolean;
  onResolve: (id: string, choice: ConflictStatus) => void;
}) {
  const TypeIcon = TYPE_ICONS[c.conflict_type] ?? AlertTriangle;
  const resolved = c.status !== "unresolved";
  const confDelta = Math.round(c.confidence_delta * 100);
  const confDeltaLabel = confDelta > 0 ? `+${confDelta}%` : `${confDelta}%`;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-2xl border border-border bg-surface p-5 shadow-card"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>{c.vendor_name || c.vendor_id}</span>
            <span>·</span>
            <span>{c.domain || "—"}</span>
            <span>·</span>
            <span>#{index + 1}</span>
          </div>
          <div className="mt-0.5 text-base font-semibold">{c.question}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
              SEVERITY_CLASSES[c.severity],
            )}
          >
            <TypeIcon className="h-3 w-3" />
            {TYPE_LABELS[c.conflict_type]} · {c.severity}
          </span>
          {resolved ? (
            <span
              className={cn(
                "rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
                c.status === "accepted_new"
                  ? "border-verified/30 bg-verified/10 text-verified"
                  : "border-warning/30 bg-warning/10 text-warning",
              )}
            >
              Resolved · {c.status === "accepted_new" ? "New" : "Old"}
            </span>
          ) : (
            <span className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-danger">
              Δ {confDeltaLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <EvidenceSide
          kind="old"
          verdict={c.old_verdict}
          answer={c.old_answer}
          confidence={c.old_confidence}
          chosen={c.status === "accepted_old"}
          rejected={c.status === "accepted_new"}
          pending={pending}
          onAccept={() => onResolve(c.id, "accepted_old")}
        />
        <EvidenceSide
          kind="new"
          verdict={c.new_verdict}
          answer={c.new_answer}
          confidence={c.new_confidence}
          chosen={c.status === "accepted_new"}
          rejected={c.status === "accepted_old"}
          pending={pending}
          onAccept={() => onResolve(c.id, "accepted_new")}
        />
      </div>
    </motion.li>
  );
}

function EvidenceSide({
  kind,
  verdict,
  answer,
  confidence,
  chosen,
  rejected,
  pending,
  onAccept,
}: {
  kind: "old" | "new";
  verdict: Verdict;
  answer: string | null;
  confidence: number;
  chosen: boolean;
  rejected: boolean;
  pending: boolean;
  onAccept: () => void;
}) {
  const tag = kind === "old" ? "Previous answer" : "Latest upload";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        chosen
          ? "border-verified/40 bg-verified/5"
          : rejected
            ? "border-border/60 bg-surface/30 opacity-60"
            : "border-border bg-surface-elevated/50",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {tag}
          <span
            className={cn(
              "rounded-sm border px-1.5 py-0.5 text-[9px]",
              VERDICT_CLASSES[verdict],
            )}
          >
            {verdict === "N_A" ? "IDK" : verdict}
          </span>
        </span>
        <span className="font-mono-num text-[10px] text-muted-foreground">
          conf {(confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">
        {answer ?? <span className="italic text-muted-foreground">No answer recorded.</span>}
      </p>
      <div className="mt-3 flex items-center justify-end">
        {chosen ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-verified">
            <Check className="h-3.5 w-3.5" />
            Accepted
          </span>
        ) : rejected ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Rejected
          </span>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-signature px-3 py-1 text-xs font-medium text-signature-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Accept this
          </button>
        )}
      </div>
    </div>
  );
}
