import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, X, CheckCircle2 } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { AnswerRow, type AnswerEditPatch } from "@/components/trustlens/AnswerRow";
import { PDFPreview } from "@/components/trustlens/PDFPreview";
import { CitationsPanel } from "@/components/trustlens/CitationsPanel";
import { EvidenceSwitcher } from "@/components/trustlens/EvidenceSwitcher";
import {
  ReviewFilters,
  DEFAULT_REVIEW_FILTERS,
  applyReviewFilters,
  type ReviewFilterState,
} from "@/components/trustlens/ReviewFilters";
import { ReviewGenerateLinkDialog } from "@/components/trustlens/ReviewGenerateLinkDialog";
import { useTenant } from "@/context/TenantContext";
import { getDocument, getCachedAnswers, getVendor, documentFileUrl, updateAnswer } from "@/lib/api";
import type { QueryAnswer, TrustDocument } from "@/lib/types";

export const Route = createFileRoute("/seller/review/$docId")({
  head: () => ({
    meta: [
      { title: "Review Answers — Verifai" },
      {
        name: "description",
        content:
          "Verify AI-generated security answers against the source PDF with bounding-box evidence.",
      },
    ],
  }),
  component: ReviewPage,
});

const POLL_INTERVAL_MS = 2000;

function ReviewPage() {
  const { docId } = Route.useParams();
  const router = useRouter();
  const { activeTenant } = useTenant();

  const [doc, setDoc] = useState<TrustDocument | null>(null);
  const [vendorDocs, setVendorDocs] = useState<TrustDocument[]>([]);
  const [answers, setAnswers] = useState<QueryAnswer[] | null>(null);
  const [totalExpected, setTotalExpected] = useState<number | null>(null);
  const [precomputeStatus, setPrecomputeStatus] = useState<
    "processing" | "answering" | "web_searching" | "ready" | "failed" | null
  >(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeEvidenceIdx, setActiveEvidenceIdx] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReviewFilterState>(DEFAULT_REVIEW_FILTERS);
  const [edits, setEdits] = useState<Record<string, AnswerEditPatch>>({});
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setDoc(null);
    setVendorDocs([]);
    setAnswers(null);
    setTotalExpected(null);
    setPrecomputeStatus(null);
    setActiveId(null);
    setLoadError(null);
    setEdits({});

    if (!activeTenant) return;

    // Fetch the main doc, then pull the full vendor so we can resolve evidence
    // back to its originating document (may be different from `docId`).
    getDocument(docId, activeTenant.id)
      .then((document) => {
        setDoc(document);
        return getVendor(document.vendor_id, activeTenant.id);
      })
      .then((vendor) => setVendorDocs(vendor.documents))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = () => {
      getCachedAnswers(docId, activeTenant.id)
        .then((res) => {
          if (cancelled) return;
          setAnswers(res.answers);
          setTotalExpected(res.total);
          setPrecomputeStatus(res.status);
          const done = res.status === "ready" && res.answers.length >= res.total;
          if (!done) timer = setTimeout(poll, POLL_INTERVAL_MS);
        })
        .catch((e) => {
          if (cancelled) return;
          setLoadError(e instanceof Error ? e.message : String(e));
        });
    };
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [docId, activeTenant]);

  const mergedAnswers = useMemo<QueryAnswer[] | null>(() => {
    if (!answers) return null;
    return answers.map((a) => {
      const patch = edits[a.question_id];
      if (!patch) return a;
      return {
        ...a,
        verdict: patch.verdict,
        answer: patch.answer,
        confidence: 1.0,
        idk: false,
        source: "manual",
        evidence: [],
        citations: [],
        status: "verified",
      } satisfies QueryAnswer;
    });
  }, [answers, edits]);

  const activeAnswer = useMemo(
    () => mergedAnswers?.find((a) => a.question_id === activeId) ?? null,
    [mergedAnswers, activeId],
  );
  const hasPdfEvidence =
    !!activeAnswer && !activeAnswer.idk && activeAnswer.source === "pdf" && activeAnswer.evidence.length > 0;
  const hasWebEvidence =
    !!activeAnswer && !activeAnswer.idk && activeAnswer.source === "web" && activeAnswer.citations.length > 0;
  const splitOpen = hasPdfEvidence || hasWebEvidence;

  const docById = useMemo(() => {
    const m = new Map<string, TrustDocument>();
    vendorDocs.forEach((d) => m.set(d.id, d));
    if (doc) m.set(doc.id, doc);
    return m;
  }, [vendorDocs, doc]);

  // Reset evidence index when the user selects a different answer.
  useEffect(() => {
    setActiveEvidenceIdx(0);
  }, [activeId]);

  const activeEvidence = activeAnswer?.evidence[activeEvidenceIdx] ?? activeAnswer?.evidence[0];
  const evidenceDoc = activeEvidence ? docById.get(activeEvidence.document_id) ?? doc : doc;
  const pdfUrl = evidenceDoc ? documentFileUrl(evidenceDoc.id) : undefined;

  return (
    <SellerShell>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div className="flex items-center justify-between border-b border-border bg-background/60 px-8 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.navigate({ to: "/seller" })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Review Queue
              </div>
              <div className="text-sm font-medium">
                {doc?.filename ?? (loadError ? "Failed to load" : "Loading document…")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mergedAnswers && (precomputeStatus === "answering" || precomputeStatus === "web_searching") && totalExpected ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-signature" />
                {precomputeStatus === "web_searching" ? (
                  <>
                    <span className="font-mono-num text-foreground">
                      {mergedAnswers.filter((a) => !a.idk).length}/{totalExpected}
                    </span>{" "}
                    resolved · searching web for gaps
                  </>
                ) : (
                  <>
                    <span className="font-mono-num text-foreground">
                      {mergedAnswers.length}/{totalExpected}
                    </span>{" "}
                    grounding against PDF
                  </>
                )}
              </span>
            ) : mergedAnswers ? (
              <span className="text-xs text-muted-foreground">
                <span className="font-mono-num text-foreground">
                  {mergedAnswers.filter((a) => !a.idk).length}
                </span>{" "}
                answers ·{" "}
                <span className="font-mono-num text-warning">
                  {mergedAnswers.filter((a) => a.idk).length}
                </span>{" "}
                unanswered
              </span>
            ) : null}
            <button
              type="button"
              disabled={!doc || !mergedAnswers}
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-signature px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-signature-foreground transition-colors hover:bg-signature/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Review &amp; Generate Link
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <motion.div
            animate={{ width: splitOpen ? "50%" : "100%" }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="flex min-w-0 flex-col overflow-hidden"
          >
            {mergedAnswers && mergedAnswers.length > 0 ? (
              <ReviewFilters state={filters} onChange={setFilters} answers={mergedAnswers} />
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadError ? (
                <div className="m-5 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {loadError}
                </div>
              ) : !mergedAnswers || (mergedAnswers.length === 0 && precomputeStatus !== "ready") ? (
                <div className="m-5 flex flex-col gap-3 rounded-md border border-border bg-surface/50 px-5 py-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-signature" />
                    {precomputeStatus === "web_searching"
                      ? "Searching the web for unanswered questions…"
                      : totalExpected
                        ? `Grounding ${totalExpected} questions against your PDF…`
                        : "Preparing RAG pipeline…"}
                  </div>
                  {totalExpected ? (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
                      <motion.div
                        className="h-full rounded-full bg-signature"
                        animate={{ width: `${((mergedAnswers?.length ?? 0) / totalExpected) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                (() => {
                  const filtered = applyReviewFilters(mergedAnswers, filters);
                  if (filtered.length === 0) {
                    return (
                      <div className="m-5 rounded-md border border-dashed border-border bg-surface/40 px-4 py-10 text-center text-sm text-muted-foreground">
                        No questions match the current filters.
                      </div>
                    );
                  }
                  return (
                    <div>
                      {filtered.map((a) => (
                        <AnswerRow
                          key={a.question_id}
                          answer={a}
                          isActive={a.question_id === activeId}
                          editable
                          onEditSave={async (patch) => {
                            // Optimistic overlay for instant feedback.
                            setEdits((prev) => ({ ...prev, [a.question_id]: patch }));
                            if (!activeTenant) return;
                            try {
                              await updateAnswer(docId, a.question_id, activeTenant.id, patch);
                              // Refetch so the persisted backend row replaces the overlay.
                              const fresh = await getCachedAnswers(docId, activeTenant.id);
                              setAnswers(fresh.answers);
                              setEdits((prev) => {
                                const next = { ...prev };
                                delete next[a.question_id];
                                return next;
                              });
                            } catch (e) {
                              console.error("updateAnswer failed", e);
                              alert(
                                `Failed to save: ${e instanceof Error ? e.message : String(e)}`,
                              );
                            }
                          }}
                          onClick={() => {
                            if (a.idk || a.source === "manual") return;
                            setActiveId(a.question_id === activeId ? null : a.question_id);
                          }}
                        />
                      ))}
                      <div className="px-5 py-4 text-center text-xs text-muted-foreground">
                        <Link to="/seller" className="hover:text-foreground">
                          ← Back to dashboard
                        </Link>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {splitOpen && activeAnswer && (
              <motion.aside
                key="evidence"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                className="relative w-1/2 min-w-0 border-l border-border bg-surface/30 backdrop-blur-xl"
              >
                <div className="flex h-full flex-col">
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
                      onClick={() => setActiveId(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {hasPdfEvidence && activeAnswer.evidence.length > 1 && (
                    <EvidenceSwitcher
                      evidence={activeAnswer.evidence}
                      docById={docById}
                      activeIdx={activeEvidenceIdx}
                      onSelect={setActiveEvidenceIdx}
                    />
                  )}
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {hasPdfEvidence && activeEvidence ? (
                      <PDFPreview
                        evidence={activeEvidence}
                        filename={evidenceDoc?.filename}
                        pdfUrl={pdfUrl}
                      />
                    ) : hasWebEvidence ? (
                      <CitationsPanel
                        answer={activeAnswer.answer}
                        citations={activeAnswer.citations}
                      />
                    ) : null}
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
      {doc && mergedAnswers && (
        <ReviewGenerateLinkDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          doc={doc}
          answers={mergedAnswers}
          tenantId={activeTenant?.id ?? ""}
        />
      )}
    </SellerShell>
  );
}
