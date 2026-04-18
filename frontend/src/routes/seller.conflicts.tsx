import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Loader2, ArrowRight, Check, X, FileText } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { useTenant } from "@/context/TenantContext";
import { getConflicts, getVendor } from "@/lib/mockApi";
import type { Conflict } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflicts ΓÇö Verifai" },
      {
        name: "description",
        content:
          "Where the latest document contradicts a previously verified answer. Resolve by accepting the newer or older evidence.",
      },
    ],
  }),
  component: ConflictsPage,
});

function ConflictsPage() {
  const { activeTenant } = useTenant();
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Record<string, "accepted_new" | "accepted_old">>({});

  useEffect(() => {
    if (!activeTenant) return;
    setConflicts(null);
    getConflicts(activeTenant.id).then(async (cs) => {
      setConflicts(cs);
      const names: Record<string, string> = {};
      await Promise.all(
        cs.map(async (c) => {
          const v = await getVendor(c.vendor_id);
          names[c.vendor_id] = v.name;
        }),
      );
      setVendorNames(names);
    });
  }, [activeTenant]);

  const resolve = (id: string, choice: "accepted_new" | "accepted_old") => {
    setResolved((r) => ({ ...r, [id]: choice }));
  };

  return (
    <SellerShell>
      <div className="px-8 py-7">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {activeTenant?.name ?? "ΓÇö"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conflicts</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              When a new upload contradicts a previously verified answer, Verifai surfaces
              both sides with their citations. Pick the source of truth.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs sm:flex">
            <GitBranch className="h-3.5 w-3.5 text-danger" />
            <span className="font-mono-num text-foreground">
              {conflicts ? conflicts.length - Object.keys(resolved).length : "ΓÇö"}
            </span>
            <span className="text-muted-foreground">unresolved</span>
          </div>
        </div>

        {!conflicts ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading conflictsΓÇª
          </div>
        ) : conflicts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-12 text-center text-sm text-muted-foreground">
            No conflicts detected. All evidence aligned.
          </div>
        ) : (
          <ul className="space-y-4">
            <AnimatePresence>
              {conflicts.map((c, i) => {
                const choice = resolved[c.id];
                return (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-surface p-5 shadow-card"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {vendorNames[c.vendor_id] ?? "Service"} ┬╖ Conflict #{i + 1}
                        </div>
                        <div className="mt-0.5 text-base font-semibold">{c.question}</div>
                      </div>
                      {choice ? (
                        <span
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
                            choice === "accepted_new"
                              ? "border-verified/30 bg-verified/10 text-verified"
                              : "border-warning/30 bg-warning/10 text-warning",
                          )}
                        >
                          Resolved ┬╖ {choice === "accepted_new" ? "New" : "Old"}
                        </span>
                      ) : (
                        <span className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-danger">
                          Unresolved ┬╖ ╬ö {Math.round(c.confidence_delta * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <EvidenceSide
                        kind="old"
                        text={c.old_answer}
                        page={c.old_evidence.page_number}
                        chosen={choice === "accepted_old"}
                        rejected={choice === "accepted_new"}
                        onAccept={() => resolve(c.id, "accepted_old")}
                      />
                      <EvidenceSide
                        kind="new"
                        text={c.new_answer}
                        page={c.new_evidence.page_number}
                        chosen={choice === "accepted_new"}
                        rejected={choice === "accepted_old"}
                        onAccept={() => resolve(c.id, "accepted_new")}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </SellerShell>
  );
}

function EvidenceSide({
  kind,
  text,
  page,
  chosen,
  rejected,
  onAccept,
}: {
  kind: "old" | "new";
  text: string;
  page: number;
  chosen: boolean;
  rejected: boolean;
  onAccept: () => void;
}) {
  const labels =
    kind === "old"
      ? { tag: "Previous answer", icon: <ArrowRight className="h-3 w-3 rotate-180" /> }
      : { tag: "Latest upload", icon: <ArrowRight className="h-3 w-3" /> };

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
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {labels.icon}
          {labels.tag}
        </span>
        <span className="font-mono-num text-[10px] text-muted-foreground">Page {page}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileText className="h-3 w-3" />
          Cited
        </span>
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
            className="inline-flex items-center gap-1.5 rounded-md bg-signature px-3 py-1 text-xs font-medium text-signature-foreground transition-transform hover:-translate-y-0.5"
          >
            <Check className="h-3 w-3" />
            Accept this
          </button>
        )}
      </div>
    </div>
  );
}
