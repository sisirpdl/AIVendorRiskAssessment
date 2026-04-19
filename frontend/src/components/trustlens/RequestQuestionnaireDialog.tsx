import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Mail, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestQuestionnaireDialogProps {
  tenantName?: string;
  onClose: () => void;
}

function randomToken(): string {
  // 10-char alphanumeric token — demo placeholder
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function RequestQuestionnaireDialog({ tenantName, onClose }: RequestQuestionnaireDialogProps) {
  // Generate once per mount so it's stable while the dialog is open
  const token = useMemo(() => randomToken(), []);
  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://verifai.app";
  const url = `${origin}/respond/${token}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the input for manual copy
      const input = document.getElementById("rq-link") as HTMLInputElement | null;
      input?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-card"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signature/10 text-signature">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-signature">
                Send Questionnaire
              </div>
              <h2 className="mt-0.5 text-base font-semibold">Request vendor posture</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Share this link with a vendor to request completion of
          {tenantName ? ` ${tenantName}'s` : " your"} security questionnaire. The vendor will
          answer from their trust package and publish a signed report back to your vault.
        </p>

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Questionnaire link
        </label>
        <div className="flex items-center gap-2">
          <input
            id="rq-link"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 font-mono-num text-[12px] text-foreground outline-none focus:border-signature/60 focus:ring-1 focus:ring-signature/30"
          />
          <button
            type="button"
            onClick={copyLink}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
              copied
                ? "border-verified/40 bg-verified/10 text-verified"
                : "border-border bg-signature text-signature-foreground hover:bg-signature/90",
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <a
            href={`mailto:?subject=${encodeURIComponent(
              `Vendor questionnaire — ${tenantName ?? "Verifai"}`,
            )}&body=${encodeURIComponent(
              `Please complete our security questionnaire at:\n\n${url}\n\n— ${tenantName ?? "Verifai buyer"}`,
            )}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            Email link
          </a>
          <span className="ml-auto text-[10px] text-muted-foreground">
            Link stays active for 30 days
          </span>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/85">Heads up:</span>{" "}
          This is a demo link. Response portal wiring is planned — for now the URL is a placeholder.
        </div>
      </motion.div>
    </div>
  );
}
