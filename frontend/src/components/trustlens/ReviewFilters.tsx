import { ChevronDown, Search } from "lucide-react";
import { useMemo } from "react";
import type { QueryAnswer, Verdict, AnswerSource } from "@/lib/types";
import { DOMAINS } from "@/lib/types";
import { cn } from "@/lib/utils";

export type VerdictFilter = "all" | Verdict;
export type SourceFilter = "all" | AnswerSource;

export interface ReviewFilterState {
  verdict: VerdictFilter;
  source: SourceFilter;
  domain: string; // "all" or a value from DOMAINS
  query: string;
}

interface ReviewFiltersProps {
  state: ReviewFilterState;
  onChange: (next: ReviewFilterState) => void;
  answers: QueryAnswer[];
}

const VERDICT_OPTIONS: { value: VerdictFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "N_A", label: "Unresolved" },
];

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "Any source" },
  { value: "pdf", label: "PDF only" },
  { value: "web", label: "Web only" },
];

export function ReviewFilters({ state, onChange, answers }: ReviewFiltersProps) {
  const counts = useMemo(() => {
    const byVerdict: Record<string, number> = { all: answers.length, YES: 0, NO: 0, N_A: 0 };
    answers.forEach((a) => {
      byVerdict[a.verdict] = (byVerdict[a.verdict] ?? 0) + 1;
    });
    return byVerdict;
  }, [answers]);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/60 bg-background/60 px-5 py-3 backdrop-blur-xl">
      {/* Verdict pills */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
        {VERDICT_OPTIONS.map((opt) => {
          const active = state.verdict === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...state, verdict: opt.value })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors",
                active
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
              <span className="font-mono-num tabular-nums text-[10px] text-muted-foreground">
                {counts[opt.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Source select */}
      <label className="relative">
        <select
          value={state.source}
          onChange={(e) => onChange({ ...state, source: e.target.value as SourceFilter })}
          className="h-8 appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-[11px] font-medium uppercase tracking-wider text-foreground outline-none hover:border-border/80 focus:border-signature/60 focus:ring-2 focus:ring-signature/20"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </label>

      {/* Domain select */}
      <label className="relative">
        <select
          value={state.domain}
          onChange={(e) => onChange({ ...state, domain: e.target.value })}
          className="h-8 appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-[11px] font-medium uppercase tracking-wider text-foreground outline-none hover:border-border/80 focus:border-signature/60 focus:ring-2 focus:ring-signature/20"
        >
          <option value="all">All domains</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </label>

      {/* Search */}
      <div className="relative ml-auto w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={state.query}
          onChange={(e) => onChange({ ...state, query: e.target.value })}
          placeholder="Search questions or answers…"
          className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[12px] outline-none transition-colors placeholder:text-muted-foreground focus:border-signature/60 focus:ring-2 focus:ring-signature/20"
        />
      </div>
    </div>
  );
}

export const DEFAULT_REVIEW_FILTERS: ReviewFilterState = {
  verdict: "all",
  source: "all",
  domain: "all",
  query: "",
};

export function applyReviewFilters(answers: QueryAnswer[], f: ReviewFilterState): QueryAnswer[] {
  const q = f.query.trim().toLowerCase();
  return answers.filter((a) => {
    if (f.verdict !== "all" && a.verdict !== f.verdict) return false;
    if (f.source !== "all" && a.source !== f.source) return false;
    if (f.domain !== "all" && a.domain !== f.domain) return false;
    if (q) {
      const haystack = `${a.question} ${a.answer ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
