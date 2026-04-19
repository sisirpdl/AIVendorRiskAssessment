import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  ScanText,
  Brain,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { useTenant } from "@/context/TenantContext";
import { getDocuments, uploadDocument } from "@/lib/api";
import type { TrustDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/upload")({
  head: () => ({
    meta: [
      { title: "Upload Trust Package — Verifai" },
      {
        name: "description",
        content:
          "Drop a SOC 2, ISO, or vendor questionnaire — Verifai parses, embeds, and answers with bbox-grounded evidence.",
      },
    ],
  }),
  component: UploadPage,
});

type Stage = "idle" | "uploading" | "parsing" | "embedding" | "answering" | "done" | "failed";

const PIPELINE: { id: Stage; label: string; icon: typeof FileText; hint: string }[] = [
  { id: "uploading", label: "Uploading file", icon: UploadCloud, hint: "Streaming to secure storage" },
  { id: "parsing", label: "Parsing PDF", icon: ScanText, hint: "Extracting text and bounding boxes" },
  { id: "embedding", label: "Embedding chunks", icon: Sparkles, hint: "Vectorizing semantic chunks" },
  { id: "answering", label: "Grounding evidence", icon: Brain, hint: "Indexing citations for retrieval" },
];

function UploadPage() {
  const router = useRouter();
  const { activeTenant } = useTenant();
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [recentDocs, setRecentDocs] = useState<TrustDocument[]>([]);
  const [targetDocId, setTargetDocId] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ pages: number; chunks: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshRecent = useCallback(() => {
    if (!activeTenant) return;
    getDocuments(activeTenant.id)
      .then((d) => setRecentDocs(d.slice(0, 4)))
      .catch(() => setRecentDocs([]));
  }, [activeTenant]);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  const startPipeline = useCallback(
    (file: File) => {
      if (!activeTenant) return;
      setFilename(file.name);
      setStage("uploading");
      setProgress(0);
      setErrorMsg(null);
      setTargetDocId(null);
      setUploadSummary(null);

      // Visual pipeline: advance stage on a timer while the real request flies.
      const visual: Stage[] = ["uploading", "parsing", "embedding", "answering"];
      let vi = 0;
      let stopped = false;
      const tickStage = () => {
        if (stopped) return;
        setStage(visual[vi]);
        let p = 0;
        const id = setInterval(() => {
          if (stopped) {
            clearInterval(id);
            return;
          }
          p += 4 + Math.random() * 9;
          setProgress(Math.min(100, p));
          if (p >= 100) {
            clearInterval(id);
            vi = Math.min(vi + 1, visual.length - 1);
            setTimeout(tickStage, 200);
          }
        }, 80);
      };
      tickStage();

      uploadDocument(file, activeTenant.id)
        .then((result) => {
          stopped = true;
          setTargetDocId(result.document_id);
          setUploadSummary({ pages: result.page_count, chunks: result.chunk_count });
          setProgress(100);
          setStage("done");
          refreshRecent();
        })
        .catch((err: unknown) => {
          stopped = true;
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMsg(msg);
          setStage("failed");
        });
    },
    [activeTenant, refreshRecent],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) startPipeline(file);
    },
    [startPipeline],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) startPipeline(file);
    },
    [startPipeline],
  );

  const reset = () => {
    setStage("idle");
    setProgress(0);
    setFilename(null);
    setTargetDocId(null);
    setUploadSummary(null);
    setErrorMsg(null);
  };

  const goReview = () => {
    if (targetDocId) {
      router.navigate({ to: "/seller/review/$docId", params: { docId: targetDocId } });
    } else {
      router.navigate({ to: "/seller" });
    }
  };

  return (
    <SellerShell>
      <div className="px-8 py-7">
        <div className="mb-7">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {activeTenant?.name ?? "—"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Upload trust package</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop a SOC 2, ISO 27001, or vendor questionnaire PDF. Verifai parses, embeds, and
            answers — every answer cited to a bounding box on the source page.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {stage === "idle" ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => inputRef.current?.click()}
                  className="group relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface/40 p-8 text-center transition-all hover:border-signature/60 hover:bg-signature/5"
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf"
                    onChange={onPick}
                    className="hidden"
                  />
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated text-signature shadow-[0_0_24px_rgba(250,204,21,0.15)] transition-all group-hover:shadow-[0_0_32px_rgba(250,204,21,0.4)]">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold">Drop your trust package here</h2>
                  <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                    PDF only for this release. Parsing, embedding, and answer generation happen
                    automatically on the backend.
                  </p>
                  <button
                    type="button"
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-signature px-5 py-2.5 text-sm font-medium text-signature-foreground shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-transform hover:-translate-y-0.5"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Browse files
                  </button>
                  <p className="mt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
                    SOC 2 · ISO 27001 · CAIQ · Custom questionnaires
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="pipeline"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-border bg-surface p-6 shadow-card"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-signature">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{filename}</div>
                        <div className="text-xs text-muted-foreground">
                          {stage === "done"
                            ? "Ready for review"
                            : stage === "failed"
                              ? "Upload failed"
                              : "Processing…"}
                        </div>
                      </div>
                    </div>
                    {(stage === "done" || stage === "failed") && (
                      <button
                        type="button"
                        onClick={reset}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <ol className="space-y-2">
                    {PIPELINE.map((step) => {
                      const order = PIPELINE.findIndex((s) => s.id === stage);
                      const myOrder = PIPELINE.findIndex((s) => s.id === step.id);
                      const isActive = step.id === stage;
                      const isDone = stage === "done" || myOrder < order;
                      const Icon = step.icon;
                      return (
                        <li
                          key={step.id}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                            isActive
                              ? "border-signature/50 bg-signature/5"
                              : isDone
                                ? "border-verified/30 bg-verified/5"
                                : "border-border bg-surface/40",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              isActive
                                ? "bg-signature/20 text-signature"
                                : isDone
                                  ? "bg-verified/15 text-verified"
                                  : "bg-surface-elevated text-muted-foreground",
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : isActive ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{step.label}</div>
                            <div className="text-[11px] text-muted-foreground">{step.hint}</div>
                          </div>
                          {isActive && (
                            <div className="w-32 shrink-0">
                              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                                <motion.div
                                  className="h-full rounded-full bg-signature"
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.2 }}
                                />
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>

                  {stage === "done" && uploadSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 flex items-center justify-between rounded-xl border border-verified/30 bg-verified/5 px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-verified" />
                        <div>
                          <div className="text-sm font-medium">
                            {uploadSummary.pages} pages · {uploadSummary.chunks} chunks indexed
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Grounded evidence ready — click to review
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={goReview}
                        className="inline-flex items-center gap-2 rounded-lg bg-signature px-4 py-2 text-sm font-medium text-signature-foreground shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-transform hover:-translate-y-0.5"
                      >
                        Review answers
                      </button>
                    </motion.div>
                  )}

                  {stage === "failed" && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-5 py-4 text-sm"
                    >
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                      <div className="min-w-0">
                        <div className="font-medium">Upload failed</div>
                        <div className="mt-0.5 break-words text-xs text-muted-foreground">
                          {errorMsg ?? "Unknown error"}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                What happens next
              </div>
              <ol className="space-y-2.5 text-sm">
                {[
                  "PDF is parsed by PyMuPDF with per-span bounding boxes.",
                  "Chunks are embedded locally (all-MiniLM-L6-v2) and indexed in ChromaDB.",
                  "Ask any question — Claude grounds its answer in retrieved spans.",
                  "Every answer carries a bounding-box citation on the source page.",
                ].map((line, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="font-mono-num mt-0.5 text-[11px] font-medium text-signature">
                      0{i + 1}
                    </span>
                    <span className="text-muted-foreground">{line}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Recent uploads
              </div>
              {recentDocs.length === 0 ? (
                <div className="text-xs text-muted-foreground">No documents yet.</div>
              ) : (
                <ul className="space-y-2">
                  {recentDocs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2 text-xs"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{d.filename}</div>
                        <div className="text-muted-foreground">
                          {d.vendor_name} · {d.pages} pages
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </SellerShell>
  );
}
