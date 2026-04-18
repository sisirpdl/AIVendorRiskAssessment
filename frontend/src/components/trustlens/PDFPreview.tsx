import { useEffect, useRef, useState } from "react";
import { BBoxOverlay } from "./BBoxOverlay";
import type { EvidenceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PDFPreviewProps {
  evidence: EvidenceChunk;
  filename?: string;
  className?: string;
}

// Stylized fake PDF page. US Letter aspect ratio (612x792 → ~0.77).
export function PDFPreview({ evidence, filename, className }: PDFPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Build deterministic fake text lines
  const lines = Array.from({ length: 22 }, (_, i) => {
    const widths = [98, 94, 86, 92, 80, 88, 76, 90, 72, 84];
    return widths[(i + (evidence.page_number ?? 1)) % widths.length];
  });

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

      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-surface-elevated p-4 shadow-card">
        <div
          ref={containerRef}
          className="relative mx-auto aspect-[612/792] w-full max-w-full overflow-hidden rounded-md bg-[oklch(0.96_0.005_250)] text-[oklch(0.18_0.02_260)] shadow-[0_8px_32px_oklch(0_0_0/0.6)]"
        >
          {/* Fake document chrome */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[oklch(0.85_0.005_250)] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-[oklch(0.45_0.02_260)]">
            <span>SOC 2 Type II Report</span>
            <span>Confidential</span>
          </div>

          <div className="absolute inset-x-0 top-10 px-6">
            <div className="mb-3 h-3 w-2/3 rounded-sm bg-[oklch(0.75_0.02_260)]" />
            <div className="mb-5 h-2 w-1/3 rounded-sm bg-[oklch(0.82_0.02_260)]" />
            <div className="space-y-1.5">
              {lines.map((w, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-sm bg-[oklch(0.85_0.01_260)]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>

          <div className="absolute bottom-3 right-4 font-mono-num text-[10px] text-[oklch(0.5_0.02_260)]">
            {evidence.page_number}
          </div>

          {/* Bbox overlay */}
          {size.w > 0 && (
            <BBoxOverlay
              key={evidence.chunk_id}
              bbox={evidence.bbox}
              pageWidth={evidence.page_width}
              pageHeight={evidence.page_height}
              canvasWidth={size.w}
              canvasHeight={size.h}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-signature">
          Extracted text
        </div>
        <p className="text-foreground/85">{evidence.text}</p>
      </div>
    </div>
  );
}
