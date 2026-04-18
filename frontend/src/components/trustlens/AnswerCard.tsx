import { motion } from "framer-motion";
import { Check, ChevronRight, Globe, HelpCircle, X, FileText } from "lucide-react";
import type { QueryAnswer, Verdict } from "@/lib/types";
import { ConfidenceBar } from "./ConfidenceBar";
import { IDKBadge } from "./IDKBadge";
import { cn } from "@/lib/utils";

const VERDICT_STYLES: Record<Verdict, string> = {
  YES: "bg-verified/15 text-verified border-verified/40",
  NO: "bg-danger/15 text-danger border-danger/40",
  N_A: "bg-surface-elevated text-muted-foreground border-border",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  YES: "Yes",
  NO: "No",
  N_A: "N/A",
};

interface AnswerCardProps {
  answer: QueryAnswer;
  isActive?: boolean;
  onClick?: () => void;
}

export function AnswerCard({ answer, isActive, onClick }: AnswerCardProps) {
  const verdict = answer.verdict;
  const VerdictIcon = verdict === "YES" ? Check : verdict === "NO" ? X : HelpCircle;
  const isWeb = answer.source === "web";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group relative w-full rounded-xl border bg-surface px-5 py-4 text-left shadow-card transition-colors",
        isActive
          ? "border-signature/50 bg-surface/80 signature-edge"
          : "border-border hover:border-border/80",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {answer.domain}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            VERDICT_STYLES[verdict],
          )}
        >
          <VerdictIcon className="h-3 w-3" />
          {VERDICT_LABEL[verdict]}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            isWeb
              ? "border-signature/30 bg-signature/5 text-signature"
              : "border-border bg-surface-elevated text-muted-foreground",
          )}
          title={isWeb ? "Grounded via web search" : "Grounded from uploaded PDF"}
        >
          {isWeb ? <Globe className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {isWeb ? "Web" : "PDF"}
        </span>
      </div>

      <h3 className="mb-3 text-[15px] font-medium leading-snug text-foreground">
        {answer.question}
      </h3>

      {answer.idk || answer.answer === null ? (
        <IDKBadge />
      ) : (
        <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {answer.answer}
        </p>
      )}

      {!answer.idk && (
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <ConfidenceBar value={answer.confidence} />
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-signature opacity-70 transition-opacity group-hover:opacity-100">
            {isWeb ? "View Sources" : "View Evidence"}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </motion.button>
  );
}
