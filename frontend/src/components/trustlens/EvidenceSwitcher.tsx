import { FileText } from "lucide-react";
import type { EvidenceChunk, TrustDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EvidenceSwitcherProps {
  evidence: EvidenceChunk[];
  docById: Map<string, TrustDocument>;
  activeIdx: number;
  onSelect: (idx: number) => void;
}

function shortName(filename?: string): string {
  if (!filename) return "document";
  // Trim extension + keep it short enough for a chip
  const stripped = filename.replace(/\.pdf$/i, "");
  return stripped.length > 22 ? stripped.slice(0, 20) + "…" : stripped;
}

/**
 * Horizontal strip of chips — one per retrieved chunk — shown above the PDF
 * preview when an answer draws from more than one evidence span. Each chip
 * labels the source document it came from so clicking through is meaningful
 * in a multi-document vendor.
 */
export function EvidenceSwitcher({ evidence, docById, activeIdx, onSelect }: EvidenceSwitcherProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-surface/40 px-5 py-2">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {evidence.length} pieces
      </span>
      {evidence.map((ev, i) => {
        const active = i === activeIdx;
        const fname = shortName(docById.get(ev.document_id)?.filename);
        return (
          <button
            key={ev.chunk_id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
              active
                ? "border-signature/50 bg-signature/10 text-signature"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
            title={`${fname} · page ${ev.page_number} · ${Math.round(ev.relevance_score * 100)}% relevance`}
          >
            <FileText className="h-3 w-3" />
            <span className="font-mono-num text-[10px]">{i + 1}</span>
            <span className="max-w-[120px] truncate">{fname}</span>
            <span className="font-mono-num text-[10px] text-muted-foreground">
              p{ev.page_number}
            </span>
          </button>
        );
      })}
    </div>
  );
}
