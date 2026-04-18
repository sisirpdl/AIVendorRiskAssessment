import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, FileText, Globe, HelpCircle, Pencil, X } from "lucide-react";
import type { QueryAnswer, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERDICT_STYLES: Record<Verdict, string> = {
  YES: "bg-verified/10 text-verified border-verified/30",
  NO: "bg-danger/10 text-danger border-danger/30",
  N_A: "bg-warning/10 text-warning border-warning/30",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  YES: "Yes",
  NO: "No",
  N_A: "N/A",
};

const CONFIDENCE_COLOR = (v: number): string =>
  v >= 0.75 ? "text-verified" : v >= 0.4 ? "text-warning" : "text-muted-foreground";

export interface AnswerEditPatch {
  verdict: Verdict;
  answer: string;
}

interface AnswerRowProps {
  answer: QueryAnswer;
  isActive?: boolean;
  onClick?: () => void;
  editable?: boolean;
  onEditSave?: (patch: AnswerEditPatch) => void;
}

export function AnswerRow({ answer, isActive, onClick, editable, onEditSave }: AnswerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVerdict, setEditVerdict] = useState<Verdict>(
    answer.idk ? "YES" : answer.verdict,
  );
  const [editText, setEditText] = useState(answer.answer ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const VerdictIcon = answer.verdict === "YES" ? Check : answer.verdict === "NO" ? X : HelpCircle;
  const isWeb = answer.source === "web";
  const isManual = answer.source === "manual";
  const hideSourcePill = answer.idk || isManual;
  const canEdit = editable && !!onEditSave;
  const clickable = isEditing ? false : canEdit && (answer.idk || isManual) ? true : !answer.idk;

  function openEdit() {
    setEditVerdict(answer.idk ? "YES" : answer.verdict);
    setEditText(answer.answer ?? "");
    setIsEditing(true);
  }
  function cancelEdit() {
    setIsEditing(false);
  }
  function saveEdit() {
    if (!onEditSave) return;
    onEditSave({ verdict: editVerdict, answer: editText.trim() });
    setIsEditing(false);
  }

  function handleRowClick() {
    if (isEditing) return;
    if (canEdit && (answer.idk || isManual)) {
      openEdit();
      return;
    }
    onClick?.();
  }

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleRowClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRowClick();
              }
            }
          : undefined
      }
      className={cn(
        "group relative block w-full border-b border-border/60 text-left transition-colors",
        clickable ? "cursor-pointer" : "cursor-default",
        isActive ? "bg-surface/80" : "bg-transparent hover:bg-surface/50",
        isEditing && "bg-surface/80",
      )}
    >
      {isActive && !isEditing && (
        <span className="absolute left-0 top-0 h-full w-0.5 bg-signature" aria-hidden />
      )}
      <div className="grid grid-cols-[64px_1fr_auto_auto_56px_16px] items-center gap-3 px-5 py-2.5">
        <div className="font-mono-num text-[11px] tabular-nums text-muted-foreground">
          {answer.question_id}
        </div>

        <div className="min-w-0">
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {answer.domain}
          </div>
          <div className="truncate text-[13.5px] font-medium text-foreground">
            {answer.question}
          </div>
        </div>

        {hideSourcePill ? (
          <span aria-hidden />
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80"
            title={isWeb ? "Grounded via web search" : "Grounded from uploaded PDF"}
          >
            {isWeb ? <Globe className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {isWeb ? "Web" : "PDF"}
          </span>
        )}

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            VERDICT_STYLES[answer.verdict],
          )}
        >
          <VerdictIcon className="h-3 w-3" />
          {VERDICT_LABEL[answer.verdict]}
        </span>

        <div
          className={cn(
            "text-right font-mono-num text-[11px] tabular-nums",
            answer.idk ? "text-muted-foreground/60" : CONFIDENCE_COLOR(answer.confidence),
          )}
        >
          {answer.idk ? "—" : `${Math.round(answer.confidence * 100)}%`}
        </div>

        {canEdit && (answer.idk || isManual) && !isEditing ? (
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity opacity-0 group-hover:opacity-100" />
        ) : (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity",
              clickable && !isEditing ? "opacity-0 group-hover:opacity-100" : "opacity-0",
            )}
          />
        )}
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden border-t border-border/40 bg-surface/40"
        >
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Verdict
              </span>
              {(["YES", "NO", "N_A"] as Verdict[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditVerdict(v);
                  }}
                  className={cn(
                    "rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    editVerdict === v
                      ? VERDICT_STYLES[v]
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {VERDICT_LABEL[v]}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              rows={3}
              placeholder="Enter the verified answer…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-signature/50 focus:outline-none focus:ring-1 focus:ring-signature/30"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEdit();
                }}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  saveEdit();
                }}
                className="rounded-md bg-signature px-3 py-1.5 text-xs font-semibold text-signature-foreground transition-colors hover:bg-signature/90"
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hover reveal: answer preview */}
      {!isEditing && !answer.idk && answer.answer && (
        <div className="grid-rows-[0fr] grid overflow-hidden transition-[grid-template-rows] duration-200 group-hover:grid-rows-[1fr]">
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-border/40 bg-surface/30 px-5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
              <span className="text-foreground/85">{answer.answer}</span>
              {isWeb && answer.citations.length > 0 && (
                <span className="ml-2 text-[11px] text-signature/80">
                  · {answer.citations.length} source{answer.citations.length === 1 ? "" : "s"}
                </span>
              )}
              {isManual && (
                <span className="ml-2 text-[11px] text-warning/80">· manually entered</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
