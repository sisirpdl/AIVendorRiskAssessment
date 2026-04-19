import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Building2, FileText, Loader2, X } from "lucide-react";
import { BuyerShell } from "@/components/trustlens/BuyerShell";
import { ConfidenceRing } from "@/components/trustlens/ConfidenceRing";
import { AnswerRow } from "@/components/trustlens/AnswerRow";
import { PDFPreview } from "@/components/trustlens/PDFPreview";
import { CitationsPanel } from "@/components/trustlens/CitationsPanel";
import { EvidenceSwitcher } from "@/components/trustlens/EvidenceSwitcher";
import { getVendor, documentFileUrl } from "@/lib/api";
import { useTenant } from "@/context/TenantContext";
import type { QueryAnswer, TrustDocument, Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer_/assess/$vendorId")({
  head: () => ({
    meta: [
      { title: "Service Assessment — Verifai" },
      {
        name: "description",
        content:
          "Compact, row-by-row breakdown of a vendor's verified security posture with bbox-grounded evidence.",
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

function AssessPage() {
  const { vendorId } = Route.useParams();
  const { activeTenant } = useTenant();
  const [service, setService] = useState<Vendor | null>(null);
  const [answers, setAnswers] = useState<QueryAnswer[] | null>(null);
  const [docs, setDocs] = useState<TrustDocument[]>([]);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"all" | "YES" | "NO" | "N_A">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeTenant) return;
    setService(null);
    setAnswers(null);
    getVendor(vendorId, activeTenant.id).then((v) => {
      setService(v);
      setAnswers(v.answers);
      setDocs(v.documents);
    });
  }, [vendorId, activeTenant]);

  const domains = useMemo(() => {
    if (!answers) return [];
    const set = new Set<string>();
    answers.forEach((a) => set.add(a.domain));
    return Array.from(set).sort();
  }, [answers]);

  const filtered = useMemo(() => {
    if (!answers) return [];
    return answers.filter((a) => {
      if (domain && a.domain !== domain) return false;
      if (verdict !== "all" && a.verdict !== verdict) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!a.question.toLowerCase().includes(q) && !(a.answer ?? "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [answers, domain, verdict, query]);

  const [activeEvidenceIdx, setActiveEvidenceIdx] = useState(0);

  const activeAnswer = useMemo(
    () => answers?.find((a) => a.question_id === activeAnswerId) ?? null,
    [answers, activeAnswerId],
  );
  useEffect(() => {
    setActiveEvidenceIdx(0);
  }, [activeAnswerId]);

  const docById = useMemo(() => {
    const m = new Map<string, TrustDocument>();
    docs.forEach((d) => m.set(d.id, d));
    return m;
  }, [docs]);

  const activeEvidence = activeAnswer?.evidence[activeEvidenceIdx] ?? activeAnswer?.evidence[0];
  const activeDoc = useMemo(() => {
    if (!activeEvidence) return null;
    return docById.get(activeEvidence.document_id) ?? docs[0] ?? null;
  }, [activeEvidence, docById, docs]);

  return (
    <BuyerShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
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
            <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-signature/30 to-signature/5 font-mono-num text-base font-semibold text-signature">
                    {initials(service.name)}
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Service Assessment
                    </div>
                    <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
                      {service.name}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {service.document_count} documents
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {answers.length} answered questions
                      </span>
                    </div>
                  </div>
                </div>

                <ConfidenceRing
                  value={service.overall_score}
                  size={88}
                  strokeWidth={7}
                  label="Overall"
                />
              </div>
            </div>

            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "YES", label: "Yes" },
                  { key: "NO", label: "No" },
                  { key: "N_A", label: "Unresolved" },
                ] as { key: typeof verdict; label: string }[]
              ).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVerdict(v.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    verdict === v.key
                      ? "border-signature/60 bg-signature/10 text-signature"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                type="button"
                onClick={() => setDomain(null)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  domain === null
                    ? "border-signature/60 bg-signature/10 text-signature"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                All domains
              </button>
              {domains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomain(domain === d ? null : d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    domain === d
                      ? "border-signature/60 bg-signature/10 text-signature"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions or answers…"
                className="ml-auto w-60 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-signature/50 focus:outline-none"
              />
            </div>

            {/* Compact one-row list */}
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No answers match the current filters.
                </div>
              ) : (
                filtered.map((a) => (
                  <AnswerRow
                    key={a.question_id}
                    answer={a}
                    isActive={a.question_id === activeAnswerId}
                    onClick={() => {
                      if (a.idk) return;
                      setActiveAnswerId(a.question_id === activeAnswerId ? null : a.question_id);
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Evidence drawer */}
      <AnimatePresence>
        {activeAnswer && !activeAnswer.idk && (activeAnswer.evidence[0] || activeAnswer.citations.length > 0) && (
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
                    {activeAnswer.source === "web" ? "Web Sources" : "Evidence"}
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
              {activeAnswer.source !== "web" && activeAnswer.evidence.length > 1 && (
                <EvidenceSwitcher
                  evidence={activeAnswer.evidence}
                  docById={docById}
                  activeIdx={activeEvidenceIdx}
                  onSelect={setActiveEvidenceIdx}
                />
              )}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {activeAnswer.source === "web" && activeAnswer.citations.length > 0 ? (
                  <CitationsPanel
                    answer={activeAnswer.answer}
                    citations={activeAnswer.citations}
                  />
                ) : activeEvidence ? (
                  <PDFPreview
                    evidence={activeEvidence}
                    filename={activeDoc?.filename}
                    pdfUrl={activeDoc ? documentFileUrl(activeDoc.id) : undefined}
                  />
                ) : null}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </BuyerShell>
  );
}
