import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { BBoxOverlay } from "./BBoxOverlay";
import type { EvidenceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface RealPDFPreviewProps {
  evidence: EvidenceChunk;
  pdfUrl: string;
  filename?: string;
  className?: string;
}

export function RealPDFPreview({
  evidence,
  filename,
  pdfUrl,
  className,
}: RealPDFPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setCanvasSize({ w: 0, h: 0 });
  }, [evidence.chunk_id]);

  return (
    <div className={cn("flex h-full flex-col gap-3", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground/80">
          {filename ?? "Source document"}
        </span>
        <span className="font-mono-num shrink-0">
          Page {evidence.page_number} · {Math.round(evidence.relevance_score * 100)}% relevance
        </span>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-surface-elevated p-4 shadow-card">
        <div
          ref={containerRef}
          className="relative mx-auto w-full max-w-full overflow-hidden rounded-md bg-white shadow-[0_8px_32px_oklch(0_0_0/0.6)]"
        >
          {loadError ? (
            <div className="flex aspect-[612/792] items-center justify-center p-6 text-center text-xs text-danger">
              Failed to load PDF: {loadError}
            </div>
          ) : containerWidth > 0 ? (
            <Document
              file={pdfUrl}
              loading={
                <div className="flex aspect-[612/792] items-center justify-center text-xs text-muted-foreground">
                  Loading PDF…
                </div>
              }
              error={
                <div className="flex aspect-[612/792] items-center justify-center text-xs text-danger">
                  Could not open PDF
                </div>
              }
              onLoadError={(e) => setLoadError(e.message)}
            >
              <Page
                pageNumber={evidence.page_number}
                width={containerWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onRenderSuccess={() => {
                  const canvas = containerRef.current?.querySelector("canvas");
                  if (canvas) setCanvasSize({ w: canvas.clientWidth, h: canvas.clientHeight });
                }}
              />
            </Document>
          ) : null}

          {canvasSize.w > 0 && (
            <BBoxOverlay
              key={evidence.chunk_id}
              bbox={evidence.bbox}
              pageWidth={evidence.page_width}
              pageHeight={evidence.page_height}
              canvasWidth={canvasSize.w}
              canvasHeight={canvasSize.h}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-signature">
          Extracted text
        </div>
        <p className="line-clamp-6 text-foreground/85">{evidence.text}</p>
      </div>
    </div>
  );
}
