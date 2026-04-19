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
import { getDocuments, getVendors, uploadDocument } from "@/lib/api";
import type { TrustDocument, Vendor } from "@/lib/types";
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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [targetVendorId, setTargetVendorId] = useState<string>(""); // "" = new vendor from filename
  // Multi-file queue state
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueIndex, setQueueIndex] = useState(0); // 1-based while uploading, N on completion

  const refreshRecent = useCallback(() => {
    if (!activeTenant) return;
    Promise.all([getDocuments(activeTenant.id), getVendors(activeTenant.id)])
      .then(([docs, vs]) => {
        setRecentDocs(docs.slice(0, 4));
        setVendors(vs);
      })
      .catch(() => {
        setRecentDocs([]);
        setVendors([]);
      });
  }, [activeTenant]);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  const startPipeline = useCallback(
    async (files: File[]) => {
      if (!activeTenant || files.length === 0) return;
      setStage("uploading");
      setProgress(0);
      setErrorMsg(null);
      setTargetDocId(null);
      setUploadSummary(null);
      setQueueTotal(files.length);
      setQueueIndex(0);

      const visual: Stage[] = ["uploading", "parsing", "embedding", "answering"];
      let stopped = false;

      // Visual pipeline: advance stage on a timer while the real requests fly.
      let vi = 0;
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

      // If no vendor selected and >1 file dropped, derive a shared slug from the
      // first file so subsequent files attach to the same vendor rather than
      // creating N separate vendors.
      let sharedVendor = targetVendorId;
      let lastDocId: string | null = null;
      let totalPages = 0;
      let totalChunks = 0;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setFilename(file.name);
          setQueueIndex(i + 1);
          const result = await uploadDocument(
            file,
            activeTenant.id,
            sharedVendor || undefined,
          );
          if (!sharedVendor) sharedVendor = result.vendor_id;
          lastDocId = result.document_id;
          totalPages += result.page_count;
          totalChunks += result.chunk_count;
        }
        stopped = true;
        if (lastDocId) setTargetDocId(lastDocId);
        setUploadSummary({ pages: totalPages, chunks: totalChunks });
        setProgress(100);
        setStage("done");
        refreshRecent();
      } catch (err: unknown) {
        stopped = true;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setStage("failed");
      }
    },
    [activeTenant, refreshRecent, targetVendorId],
  );

  const filesFromList = (list: FileList | null | undefined): File[] => {
    if (!list) return [];
    return Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = filesFromList(e.dataTransfer.files);
      if (files.length) startPipeline(files);
    },
    [startPipeline],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = filesFromList(e.target.files);
      if (files.length) startPipeline(files);
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
    setQueueTotal(0);
    setQueueIndex(0);
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

        {stage === "idle" && vendors.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Attach to
            </label>
            <select
              value={targetVendorId}
              onChange={(e) => setTargetVendorId(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-3 text-xs text-foreground outline-none focus:border-signature/60 focus:ring-1 focus:ring-signature/30"
            >
              <option value="">New vendor (from filename)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.document_count} {v.document_count === 1 ? "doc" : "docs"})
                </option>
              ))}
            </select>
            {targetVendorId && (
              <span className="text-[11px] text-muted-foreground">
                Existing answers will be re-generated using the pooled evidence from all uploaded documents.
              </span>
            )}
          </div>
        )}

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
                    multiple
                    onChange={onPick}
                    className="hidden"
                  />
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated text-signature shadow-[0_0_24px_rgba(250,204,21,0.15)] transition-all group-hover:shadow-[0_0_32px_rgba(250,204,21,0.4)]">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold">Drop your trust package here</h2>
                  <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                    PDFs only. Drop multiple files at once to pool evidence across them —
                    SOC 2 + pentest + DPA all feed one vendor profile.
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
                            ? queueTotal > 1
                              ? `Ready for review · ${queueTotal} files indexed`
                              : "Ready for review"
                            : stage === "failed"
                              ? "Upload failed"
                              : queueTotal > 1
                                ? `Processing file ${queueIndex} of ${queueTotal}…`
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
