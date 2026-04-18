import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, ExternalLink, Loader2, X } from "lucide-react";
import { createShareLink } from "@/lib/api";
import { answersToCsv, downloadCsv } from "@/lib/export";
import type { AnswerSource, QueryAnswer, TrustDocument, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  doc: TrustDocument;
  answers: QueryAnswer[];
  tenantId: string;
}

export function ReviewGenerateLinkDialog({ open, onClose, doc, answers, tenantId }: Props) {
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setToken(null);
      setCopied(false);
      setError(null);
      setGenerating(false);
    }
  }, [open]);

  const shareUrl = useMemo(() => {
    if (!token) return null;
    return `${window.location.origin}/share/${token}`;
  }, [token]);

  const summary = useMemo(() => {
    const answered = answers.filter((a) => !a.idk).length;
    const unanswered = answers.length - answered;
    const manual = answers.filter((a) => a.source === ("manual" as AnswerSource)).length;
    return { answered, unanswered, manual, total: answers.length };
  }, [answers]);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const edits: Record<string, { verdict: Verdict; answer: string }> = {};
      for (const a of answers) {
        if (a.source === ("manual" as AnswerSource)) {
          edits[a.question_id] = { verdict: a.verdict, answer: a.answer ?? "" };
        }
      }
      const res = await createShareLink({ tenant_id: tenantId, document_id: doc.id, edits });
      setToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function onCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function onExportCsv() {
    const csv = answersToCsv(answers);
    const base = doc.filename.replace(/\.pdf$/i, "") || "report";
    downloadCsv(`${base}.csv`, csv);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-card"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-signature">
                  Review &amp; Generate Link
                </div>
                <div className="mt-0.5 truncate text-sm font-medium">{doc.filename}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Answered" value={summary.answered} tone="verified" />
                <Stat label="Unanswered" value={summary.unanswered} tone="warning" />
                <Stat label="Manual edits" value={summary.manual} tone="signature" />
              </div>

              {!token ? (
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Generating a link creates a read-only version of this report that you can send to a buyer.
                  They'll be able to view the answers and download the report as CSV or PDF — no account required.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Shareable URL
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl ?? ""}
                      className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-foreground focus:outline-none"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      onClick={onCopy}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        copied
                          ? "border-verified/40 bg-verified/10 text-verified"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    {shareUrl && (
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={onExportCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              {!token ? (
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-md bg-signature px-4 py-1.5 text-xs font-semibold text-signature-foreground transition-colors hover:bg-signature/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {generating ? "Generating…" : "Generate link"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-md bg-signature px-4 py-1.5 text-xs font-semibold text-signature-foreground transition-colors hover:bg-signature/90"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "verified" | "warning" | "signature";
}) {
  const toneClass =
    tone === "verified" ? "text-verified" : tone === "warning" ? "text-warning" : "text-signature";
  return (
    <div className="rounded-lg border border-border bg-surface py-2.5">
      <div className={cn("font-mono-num text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
