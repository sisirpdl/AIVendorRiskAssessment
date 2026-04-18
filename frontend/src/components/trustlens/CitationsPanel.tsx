import { motion } from "framer-motion";
import { ExternalLink, Globe } from "lucide-react";
import type { Citation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CitationsPanelProps {
  answer: string | null;
  citations: Citation[];
  className?: string;
}

export function CitationsPanel({ answer, citations, className }: CitationsPanelProps) {
  return (
    <div className={cn("flex h-full flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5 text-signature" />
        <span className="font-medium uppercase tracking-wider text-signature/90">
          Web-grounded evidence
        </span>
      </div>

      {answer && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-foreground/90 shadow-card">
          {answer}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Sources ({citations.length})
        </div>
        <ul className="space-y-2">
          {citations.map((c, i) => (
            <motion.li
              key={`${c.url}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            >
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3 transition-colors hover:border-signature/40 hover:bg-surface"
              >
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-signature" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium text-foreground">
                    {c.title || c.url}
                  </div>
                  <div className="mt-0.5 truncate font-mono-num text-[10px] text-muted-foreground">
                    {c.url}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
