import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, FileText, FolderInput, Loader2, ShieldCheck, X } from "lucide-react";
import { AnswerRow } from "@/components/trustlens/AnswerRow";
import { PDFPreview } from "@/components/trustlens/PDFPreview";
import { CitationsPanel } from "@/components/trustlens/CitationsPanel";
import { EvidenceSwitcher } from "@/components/trustlens/EvidenceSwitcher";
import { documentFileUrl, getSharedReport, getTenants, shareSourceZipUrl, type SharedReport } from "@/lib/api";
import { answersToCsv, downloadCsv, downloadReportPdf } from "@/lib/export";
import { addImport, getImports, removeImport } from "@/lib/imports";
import { useTenant } from "@/context/TenantContext";
import type { Tenant, TrustDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared Trust Report — Verifai" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const router = useRouter();
  const { activeTenant } = useTenant();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importState, setImportState] = useState<"idle" | "picking" | "done">("idle");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);

  useEffect(() => {
    getTenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    setReport(null);
    setError(null);
    getSharedReport(token)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [token]);

  // If this token has already been imported into ANY tenant's vault, reflect that.
  useEffect(() => {
    if (!tenants) return;
    const alreadyImported = tenants.some((t) =>
      getImports(t.id).some((imp) => imp.token === token),
    );
    if (alreadyImported) setImportState("done");
  }, [tenants, token]);

  const domains = useMemo(() => {
    if (!report) return [] as string[];
    const set = new Set<string>();
    report.answers.forEach((a) => set.add(a.domain));
    return Array.from(set).sort();
  }, [report]);

  const filtered = useMemo(() => {
    if (!report) return [];
    return report.answers.filter((a) => {
      if (domain && a.domain !== domain) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!a.question.toLowerCase().includes(q) && !(a.answer ?? "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [report, domain, query]);

  const stats = useMemo(() => {
    if (!report) return null;
    const answered = report.answers.filter((a) => !a.idk).length;
    const yes = report.answers.filter((a) => a.verdict === "YES").length;
    const no = report.answers.filter((a) => a.verdict === "NO").length;
    const unresolved = report.answers.filter((a) => a.idk).length;
    return { answered, yes, no, unresolved, total: report.answers.length };
  }, [report]);

  const activeAnswer = useMemo(
    () => report?.answers.find((a) => a.question_id === activeAnswerId) ?? null,
    [report, activeAnswerId],
  );

  const [activeEvidenceIdx, setActiveEvidenceIdx] = useState(0);
  useEffect(() => {
    setActiveEvidenceIdx(0);
  }, [activeAnswerId]);

  const docById = useMemo(() => {
    const m = new Map<string, TrustDocument>();
    if (!report) return m;
    const build = (id: string, filename: string, page_count: number): TrustDocument => ({
      id,
      filename,
      vendor_id: report.document.vendor_id,
      vendor_name: report.document.vendor_id,
      tenant_id: "",
      uploaded_at: new Date().toISOString(),
      status: "ready",
      pages: page_count,
    });
    for (const d of report.documents) m.set(d.id, build(d.id, d.filename, d.page_count));
    // Ensure the primary doc is also present.
    m.set(
      report.document.id,
      build(report.document.id, report.document.filename, report.document.page_count),
    );
    return m;
  }, [report]);

  const activeEvidence = activeAnswer?.evidence[activeEvidenceIdx] ?? activeAnswer?.evidence[0];
  const evidenceDoc = activeEvidence ? docById.get(activeEvidence.document_id) : undefined;
  const evidencePdfUrl = evidenceDoc ? documentFileUrl(evidenceDoc.id) : undefined;
  const primaryPdfUrl = report ? documentFileUrl(report.document.id) : undefined;
  const pdfUrl = primaryPdfUrl;

  function onExportCsv() {
    if (!report) return;
    const base = report.document.filename.replace(/\.pdf$/i, "") || "trust-report";
    downloadCsv(`${base}.csv`, answersToCsv(report.answers));
  }

  async function onExportPdf() {
    if (!report || !stats) return;
    const base = report.document.filename.replace(/\.pdf$/i, "") || "trust-report";
    await downloadReportPdf(
      `${base}-report.pdf`,
      {
        vendorName: report.document.vendor_id,
        filename: report.document.filename,
        total: stats.total,
        yes: stats.yes,
        no: stats.no,
        unresolved: stats.unresolved,
      },
      report.answers,
    );
  }

  function onImportClick() {
    if (!report) return;
    if (activeTenant) {
      importInto(activeTenant.id);
    } else {
      setImportState("picking");
    }
  }

  function importInto(tenantId: string) {
    if (!report) return;
    addImport(tenantId, {
      token: report.token,
      vendorName: report.document.vendor_id,
      filename: report.document.filename,
      answers: report.answers,
    });
    setImportState("done");
    router.navigate({ to: "/buyer" });
  }

  if (error) {
    const isMissing = /404|not found|expired/i.test(error);
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-danger/30 bg-danger/5 px-5 py-6 text-center text-sm">
          <div className="font-medium text-danger">
            {isMissing ? "This shared report is no longer available." : error}
          </div>
          {isMissing && (
            <div className="mt-2 text-xs text-muted-foreground">
              The underlying document was removed or the backend data was reset.
            </div>
          )}
          {isMissing && (
            <button
              type="button"
              onClick={() => {
                if (tenants) {
                  for (const t of tenants) removeImport(t.id, token);
                }
                router.navigate({ to: "/buyer" });
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-signature px-3 py-1.5 text-xs font-semibold text-signature-foreground hover:bg-signature/90"
            >
              Remove from dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!report || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading shared report…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signature/10 text-signature">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-signature">
                Trust Report · Read-only
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold">
                {report.document.filename}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && report.documents.length > 0 && (
              <a
                href={shareSourceZipUrl(report.token)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-signature/40 hover:text-signature"
                title={
                  report.documents.length > 1
                    ? `Download all ${report.documents.length} source PDFs as a ZIP`
                    : "Download the source PDF"
                }
              >
                <FileText className="h-3.5 w-3.5" />
                {report.documents.length > 1
                  ? `Source Reports (${report.documents.length})`
                  : "Source Report"}
                <Download className="h-3 w-3 opacity-60" />
              </a>
            )}
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              title="Download this report as a PDF"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              type="button"
              onClick={onImportClick}
              disabled={importState === "done"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed",
                importState === "done"
                  ? "bg-verified/10 text-verified"
                  : "bg-signature text-signature-foreground hover:bg-signature/90",
              )}
            >
              {importState === "done" ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Imported
                </>
              ) : (
                <>
                  <FolderInput className="h-3.5 w-3.5" />
                  Import to Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-8 rounded-2xl border border-border bg-surface p-6 shadow-card print:border-none print:shadow-none">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Vendor
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {report.document.vendor_id}
              </h1>
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {report.document.filename} · {report.document.page_count} pages
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Total" value={stats.total} tone="foreground" />
              <Stat label="Yes" value={stats.yes} tone="verified" />
              <Stat label="No" value={stats.no} tone="danger" />
              <Stat label="Unresolved" value={stats.unresolved} tone="warning" />
            </div>
          </div>
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setDomain(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              domain === null
                ? "border-signature/60 bg-signature/10 text-signature"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            All domains
          </button>
          {domains.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomain(domain === d ? null : d)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                domain === d
                  ? "border-signature/60 bg-signature/10 text-signature"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions or answers…"
            className="ml-auto w-60 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-signature/50 focus:outline-none"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card print:border-none print:shadow-none">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No answers match.
            </div>
          ) : (
            filtered.map((a) => (
              <AnswerRow
                key={a.question_id}
                answer={a}
                isActive={a.question_id === activeAnswerId}
                onClick={() => {
                  if (a.idk) return;
                  setActiveAnswerId(a.question_id === activeAnswerId ? null : a.question_id);
                }}
              />
            ))
          )}
        </section>

        <footer className="mt-10 text-center text-[11px] text-muted-foreground print:mt-4">
          Generated by Verifai · Evidence-backed vendor security answers.
        </footer>
      </main>

      <AnimatePresence>
        {activeAnswer && !activeAnswer.idk && (activeAnswer.evidence[0] || activeAnswer.citations.length > 0) && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm print:hidden"
            onClick={() => setActiveAnswerId(null)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-card"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-signature">
                    {activeAnswer.source === "web" ? "Web Sources" : "Evidence"}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-sm font-medium">
                    {activeAnswer.question}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAnswerId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {activeAnswer.source !== "web" && activeAnswer.evidence.length > 1 && (
                <EvidenceSwitcher
                  evidence={activeAnswer.evidence}
                  docById={docById}
                  activeIdx={activeEvidenceIdx}
                  onSelect={setActiveEvidenceIdx}
                />
              )}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {activeAnswer.source === "web" && activeAnswer.citations.length > 0 ? (
                  <CitationsPanel answer={activeAnswer.answer} citations={activeAnswer.citations} />
                ) : activeEvidence ? (
                  <PDFPreview
                    evidence={activeEvidence}
                    filename={evidenceDoc?.filename ?? report.document.filename}
                    pdfUrl={evidencePdfUrl ?? pdfUrl}
                  />
                ) : null}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {importState === "picking" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setImportState("idle")}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-signature">
              Import to Dashboard
            </div>
            <h2 className="mt-1 text-base font-semibold">Select your organization</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This vendor will be added to your Trust Vault.
            </p>
            <div className="mt-4 space-y-2">
              {(tenants ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => importInto(t.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-left text-sm transition-colors hover:border-signature/50 hover:bg-surface-elevated"
                >
                  <span>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t.industry}
                    </span>
                  </span>
                  <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setImportState("idle")}
              className="mt-4 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "foreground" | "verified" | "danger" | "warning";
}) {
  const toneClass =
    tone === "verified"
      ? "text-verified"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
      <div className={cn("font-mono-num text-base font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
