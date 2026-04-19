import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, X, CheckCircle2 } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { AnswerCard } from "@/components/trustlens/AnswerCard";
import { PDFPreview } from "@/components/trustlens/PDFPreview";
import { useTenant } from "@/context/TenantContext";
import { getDocument, getCachedAnswers, documentFileUrl } from "@/lib/api";
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
  const [answers, setAnswers] = useState<QueryAnswer[] | null>(null);
  const [totalExpected, setTotalExpected] = useState<number | null>(null);
  const [precomputeStatus, setPrecomputeStatus] = useState<
    "processing" | "answering" | "ready" | "failed" | null
  >(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setAnswers(null);
    setTotalExpected(null);
    setPrecomputeStatus(null);
    setActiveId(null);
    setLoadError(null);

    if (!activeTenant) return;

    getDocument(docId, activeTenant.id)
      .then((document) => setDoc(document))
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

  const activeAnswer = useMemo(
    () => answers?.find((a) => a.question_id === activeId) ?? null,
    [answers, activeId],
  );
  const hasEvidence = !!activeAnswer && !activeAnswer.idk && activeAnswer.evidence[0];
  const splitOpen = !!hasEvidence;

  const pdfUrl = doc ? documentFileUrl(doc.id) : undefined;

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
            {answers && precomputeStatus === "answering" && totalExpected ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-signature" />
                <span className="font-mono-num text-foreground">
                  {answers.length}/{totalExpected}
                </span>{" "}
                grounding against PDF
              </span>
            ) : answers ? (
              <span className="text-xs text-muted-foreground">
                <span className="font-mono-num text-foreground">
                  {answers.filter((a) => !a.idk).length}
                </span>{" "}
                answers ·{" "}
                <span className="font-mono-num text-warning">
                  {answers.filter((a) => a.idk).length}
                </span>{" "}
                unanswered
              </span>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-signature px-4 py-2 text-sm font-medium text-signature-foreground shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-transform hover:-translate-y-0.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Publish All Verified
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <motion.div
            animate={{ width: splitOpen ? "50%" : "100%" }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="min-w-0 overflow-y-auto px-8 py-6"
          >
            {loadError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {loadError}
              </div>
            ) : !answers || (answers.length === 0 && precomputeStatus !== "ready") ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/50 px-5 py-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-signature" />
                  {totalExpected
                    ? `Grounding ${totalExpected} questions against your PDF…`
                    : "Preparing RAG pipeline…"}
                </div>
                {totalExpected ? (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                    <motion.div
                      className="h-full rounded-full bg-signature"
                      animate={{ width: `${((answers?.length ?? 0) / totalExpected) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-3 pb-12">
                {answers.map((a, i) => (
                  <motion.li
                    key={a.question_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
                  >
                    <AnswerCard
                      answer={a}
                      isActive={a.question_id === activeId}
                      onClick={() => {
                        if (a.idk) return;
                        setActiveId(a.question_id === activeId ? null : a.question_id);
                      }}
                    />
                  </motion.li>
                ))}
                <li className="pt-4 text-center text-xs text-muted-foreground">
                  <Link to="/seller" className="hover:text-signature">
                    ← Back to dashboard
                  </Link>
                </li>
              </ul>
            )}
          </motion.div>

          <AnimatePresence>
            {splitOpen && activeAnswer && hasEvidence && (
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
                        Evidence
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
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    <PDFPreview
                      evidence={activeAnswer.evidence[0]}
                      filename={doc?.filename}
                      pdfUrl={pdfUrl}
                    />
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SellerShell>
  );
}
