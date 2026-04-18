import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  Building2,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { BuyerShell } from "@/components/trustlens/BuyerShell";
import { ConfidenceRing } from "@/components/trustlens/ConfidenceRing";
import { ConfidenceBar } from "@/components/trustlens/ConfidenceBar";
import { IDKBadge } from "@/components/trustlens/IDKBadge";
import { PDFPreview } from "@/components/trustlens/PDFPreview";
import { getVendor, getAnswers, getDocuments } from "@/lib/mockApi";
import type { Vendor, QueryAnswer, TrustDocument } from "@/lib/types";
import { DOMAINS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer_/assess/$vendorId")({
  head: () => ({
    meta: [
      { title: "Service Assessment — Verifai" },
      {
        name: "description",
        content:
          "Domain-by-domain breakdown of a service's verified security posture, with bbox-grounded evidence per question.",
      },
    ],
  }),
  component: AssessPage,
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

function scoreTone(v: number) {
  if (v >= 80) return "text-verified";
  if (v >= 60) return "text-signature";
  if (v >= 40) return "text-warning";
  return "text-danger";
}

function AssessPage() {
  const { vendorId } = Route.useParams();
  const [service, setService] = useState<Vendor | null>(null);
  const [answers, setAnswers] = useState<QueryAnswer[] | null>(null);
  const [docs, setDocs] = useState<TrustDocument[]>([]);
  const [openDomain, setOpenDomain] = useState<string | null>(DOMAINS[0]);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);

  useEffect(() => {
    setService(null);
    setAnswers(null);
    getVendor(vendorId).then(async (v) => {
      setService(v);
      const [a, d] = await Promise.all([getAnswers(v.id), getDocuments(v.tenant_id)]);
      setAnswers(a);
      setDocs(d.filter((x) => x.vendor_id === v.id));
    });
  }, [vendorId]);

  const grouped = useMemo(() => {
    const out: Record<string, QueryAnswer[]> = {};
    DOMAINS.forEach((d) => (out[d] = []));
    (answers ?? []).forEach((a) => {
      if (!out[a.domain]) out[a.domain] = [];
      out[a.domain].push(a);
    });
    return out;
  }, [answers]);

  const activeAnswer = useMemo(
    () => answers?.find((a) => a.question_id === activeAnswerId) ?? null,
    [answers, activeAnswerId],
  );
  const activeDoc = useMemo(() => {
    if (!activeAnswer || !activeAnswer.evidence[0]) return null;
    return docs.find((d) => d.id === activeAnswer.evidence[0].document_id) ?? docs[0] ?? null;
  }, [activeAnswer, docs]);

  return (
    <BuyerShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Back */}
        <Link
          to="/buyer"
          className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Trust Vault
        </Link>

        {!service || !answers ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading service assessment…
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8 rounded-2xl border border-border bg-surface p-6 shadow-card">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-signature/30 to-signature/5 font-mono-num text-base font-semibold text-signature">
                    {initials(service.name)}
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Service Assessment
                    </div>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                      {service.name}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {service.document_count} documents
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {answers.length} answered questions
                      </span>
                      <span>·</span>
                      <span>
                        Updated{" "}
                        {Math.max(
                          1,
                          Math.round(
                            (Date.now() - new Date(service.last_updated).getTime()) /
                              86_400_000,
                          ),
                        )}
                        d ago
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <ConfidenceRing
                    value={service.overall_score}
                    size={104}
                    strokeWidth={8}
                    label="Overall"
                  />
                  <div className="hidden text-right md:block">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Verdict
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-lg font-semibold",
                        scoreTone(service.overall_score),
                      )}
                    >
                      {service.overall_score >= 80
                        ? "Verified"
                        : service.overall_score >= 60
                          ? "Acceptable"
                          : service.overall_score >= 40
                            ? "Needs Review"
                            : "At Risk"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Domain accordion */}
            <div className="space-y-3">
              {DOMAINS.map((d) => {
                const score = service.domain_scores[d] ?? 0;
                const list = grouped[d] ?? [];
                const isOpen = openDomain === d;
                return (
                  <div
                    key={d}
                    className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDomain(isOpen ? null : d)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-elevated/40"
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated",
                          scoreTone(score),
                        )}
                      >
                        {score >= 80 ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : score >= 60 ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold tracking-tight">{d}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {list.length} {list.length === 1 ? "question" : "questions"}
                        </div>
                      </div>
                      <div className="hidden w-40 sm:block">
                        <ConfidenceBar value={score / 100} showLabel={false} />
                      </div>
                      <div className={cn("font-mono-num w-10 text-right text-sm font-semibold", scoreTone(score))}>
                        {score}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden border-t border-border"
                        >
                          {list.length === 0 ? (
                            <div className="px-5 py-6 text-center text-xs text-muted-foreground">
                              No questions in this domain.
                            </div>
                          ) : (
                            <ul className="divide-y divide-border">
                              {list.map((a) => (
                                <li
                                  key={a.question_id}
                                  className="px-5 py-4 transition-colors hover:bg-surface-elevated/30"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium leading-snug">
                                        {a.question}
                                      </div>
                                      <div className="mt-2 max-w-2xl">
                                        {a.idk ? (
                                          <IDKBadge />
                                        ) : (
                                          <p className="text-xs leading-relaxed text-muted-foreground">
                                            {a.answer}
                                          </p>
                                        )}
                                      </div>
                                      {!a.idk && (
                                        <div className="mt-3 max-w-xs">
                                          <ConfidenceBar value={a.confidence} />
                                        </div>
                                      )}
                                    </div>
                                    {!a.idk && a.evidence[0] && (
                                      <button
                                        type="button"
                                        onClick={() => setActiveAnswerId(a.question_id)}
                                        className="shrink-0 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-signature transition-colors hover:border-signature/40"
                                      >
                                        View evidence
                                      </button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Evidence drawer */}
      <AnimatePresence>
        {activeAnswer && activeAnswer.evidence[0] && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setActiveAnswerId(null)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-card"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-signature">
                    Evidence
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-sm font-medium">
                    {activeAnswer.question}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAnswerId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <PDFPreview
                  evidence={activeAnswer.evidence[0]}
                  filename={activeDoc?.filename}
                />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </BuyerShell>
  );
}
