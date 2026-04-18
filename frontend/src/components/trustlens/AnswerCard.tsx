import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { QueryAnswer } from "@/lib/types";
import { ConfidenceBar } from "./ConfidenceBar";
import { IDKBadge } from "./IDKBadge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<QueryAnswer["status"], string> = {
  pending_review: "Pending Review",
  verified: "Verified",
  published: "Published",
};

const STATUS_STYLES: Record<QueryAnswer["status"], string> = {
  pending_review: "bg-warning/10 text-warning border-warning/30",
  verified: "bg-verified/10 text-verified border-verified/30",
  published: "bg-signature/15 text-signature border-signature/40",
};

interface AnswerCardProps {
  answer: QueryAnswer;
  isActive?: boolean;
  onClick?: () => void;
}

export function AnswerCard({ answer, isActive, onClick }: AnswerCardProps) {
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
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {answer.domain}
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            STATUS_STYLES[answer.status],
          )}
        >
          {STATUS_LABEL[answer.status]}
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
            View Evidence
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </motion.button>
  );
}
