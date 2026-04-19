import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Building2, Bell, Sparkles, Shield, Check } from "lucide-react";
import { SellerShell } from "@/components/trustlens/SellerShell";
import { useTenant } from "@/context/TenantContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Verifai" },
      {
        name: "description",
        content: "Tenant preferences, notifications, and AI publication policy.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { activeTenant, tenants } = useTenant();
  const [autoPublish, setAutoPublish] = useState(false);
  const [notifyConflicts, setNotifyConflicts] = useState(true);
  const [notifyIDK, setNotifyIDK] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <SellerShell>
      <div className="px-8 py-7">
        <div className="mb-7">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {activeTenant?.name ?? "—"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant preferences and AI publication policy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Tenant info */}
          <Card icon={<Building2 className="h-4 w-4" />} title="Tenant">
            <div className="space-y-3">
              <Field label="Active tenant" value={activeTenant?.name ?? "—"} />
              <Field label="Industry" value={activeTenant?.industry ?? "—"} />
              <Field
                label="Tenants on plan"
                value={`${tenants.length} of 25`}
              />
            </div>
          </Card>

          {/* AI policy */}
          <Card icon={<Sparkles className="h-4 w-4" />} title="AI publication policy">
            <div className="space-y-4">
              <Toggle
                label="Auto-publish high-confidence answers"
                hint="Skip human review when confidence ΓëÑ threshold."
                checked={autoPublish}
                onChange={setAutoPublish}
              />
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Confidence threshold</span>
                  <span className="font-mono-num text-foreground">{confidenceThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="w-full accent-[var(--signature)]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Loose ┬╖ 50%</span>
                  <span>Strict ┬╖ 99%</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notifications */}
          <Card icon={<Bell className="h-4 w-4" />} title="Notifications">
            <div className="space-y-3">
              <Toggle
                label="Notify on new conflict"
                hint="Email when a new upload contradicts verified evidence."
                checked={notifyConflicts}
                onChange={setNotifyConflicts}
              />
              <Toggle
                label="Notify on IDK answers"
                hint="Email a daily digest of unanswered questions."
                checked={notifyIDK}
                onChange={setNotifyIDK}
              />
            </div>
          </Card>

          {/* Trust */}
          <Card icon={<Shield className="h-4 w-4" />} title="Trust & compliance">
            <ul className="space-y-2.5 text-sm">
              {[
                "All uploads encrypted at rest (AES-256).",
                "Evidence chunks retained for 7 years.",
                "SOC 2 Type II report available under NDA.",
                "Single-tenant data isolation by tenant_id.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-verified"
            >
              <Check className="h-3.5 w-3.5" />
              Settings saved
            </motion.span>
          )}
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-lg bg-signature px-4 py-2 text-sm font-medium text-signature-foreground shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-transform hover:-translate-y-0.5"
          >
            <SettingsIcon className="h-4 w-4" />
            Save changes
          </button>
        </div>
      </div>
    </SellerShell>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-elevated text-signature">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated/40 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface-elevated/40 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated"
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-signature" : "bg-surface-elevated",
        )}
      >
        <motion.span
          layout
          className={cn(
            "h-4 w-4 rounded-full",
            checked ? "ml-auto bg-signature-foreground" : "bg-foreground/40",
          )}
        />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
