import type { Conflict, QueryAnswer, Tenant, TrustDocument, Vendor } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${path}${body ? ` — ${body}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Health ----------

export function health(): Promise<{ status: string }> {
  return request("/api/health");
}

// ---------- Tenants ----------
// Backend returns { tenants: [{ id, name, industry }] } (no vendor_count / color).
// Fill UI-only fields with sensible defaults so the existing components keep working.

interface BackendTenant {
  id: string;
  name: string;
  industry: string;
}

const TENANT_COLORS = ["signature", "verified", "warning"];

export async function getTenants(): Promise<Tenant[]> {
  const res = await request<{ tenants: BackendTenant[] }>("/api/tenants");
  return res.tenants.map((t, i) => ({
    id: t.id,
    name: t.name,
    industry: t.industry,
    vendor_count: 0,
    color: TENANT_COLORS[i % TENANT_COLORS.length],
  }));
}

// ---------- Documents ----------

interface BackendDocument {
  document_id: string;
  vendor_id: string;
  filename: string;
  doc_version: number;
  page_count: number;
  status: string;
  created_at: string | null;
}

export async function getDocument(documentId: string, tenantId: string): Promise<TrustDocument> {
  const d = await request<BackendDocument & { tenant_id: string }>(
    `/api/documents/${documentId}`,
  );
  return {
    id: d.document_id,
    filename: d.filename,
    vendor_id: d.vendor_id,
    vendor_name: d.vendor_id,
    tenant_id: tenantId,
    uploaded_at: d.created_at ?? new Date().toISOString(),
    status: d.status === "ready" ? "ready" : d.status === "failed" ? "failed" : "processing",
    pages: d.page_count,
  };
}

export async function getDocuments(tenantId: string): Promise<TrustDocument[]> {
  const res = await request<{ documents: BackendDocument[] }>(
    `/api/documents?tenant_id=${encodeURIComponent(tenantId)}`,
  );
  return res.documents.map((d) => ({
    id: d.document_id,
    filename: d.filename,
    vendor_id: d.vendor_id,
    vendor_name: d.vendor_id,
    tenant_id: tenantId,
    uploaded_at: d.created_at ?? new Date().toISOString(),
    status: d.status === "ready" ? "ready" : d.status === "failed" ? "failed" : "processing",
    pages: d.page_count,
  }));
}

export interface UploadResult {
  document_id: string;
  tenant_id: string;
  vendor_id: string;
  filename: string;
  doc_version: number;
  page_count: number;
  chunk_count: number;
  status: string;
}

export async function uploadDocument(
  file: File,
  tenantId: string,
  vendorId?: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const qs = new URLSearchParams({ tenant_id: tenantId });
  if (vendorId) qs.set("vendor_id", vendorId);
  return request(`/api/documents/upload?${qs.toString()}`, {
    method: "POST",
    body: form,
  });
}

export function documentFileUrl(documentId: string): string {
  return `${BASE_URL}/api/documents/${documentId}/file`;
}

export async function deleteDocument(documentId: string, tenantId: string): Promise<void> {
  await request(
    `/api/documents/${documentId}?tenant_id=${encodeURIComponent(tenantId)}`,
    { method: "DELETE" },
  );
}

// ---------- Cached answers (CAIQ precompute) ----------

export interface CachedAnswersResponse {
  status: "processing" | "answering" | "ready" | "failed";
  total: number;
  answers: QueryAnswer[];
}

export function getCachedAnswers(
  documentId: string,
  tenantId: string,
): Promise<CachedAnswersResponse> {
  const qs = new URLSearchParams({ document_id: documentId, tenant_id: tenantId });
  return request(`/api/answers?${qs.toString()}`).then((r) => {
    const raw = r as {
      status: CachedAnswersResponse["status"];
      total: number;
      answers: Array<{
        question_id: string;
        question: string;
        domain: string;
        verdict: QueryAnswer["verdict"];
        answer: string | null;
        confidence: number;
        idk: boolean;
        source: QueryAnswer["source"];
        evidence: QueryAnswer["evidence"];
        citations: QueryAnswer["citations"];
        status: QueryAnswer["status"];
      }>;
    };
    return {
      status: raw.status,
      total: raw.total,
      answers: raw.answers.map((a) => ({
        question_id: a.question_id,
        question: a.question,
        domain: a.domain,
        verdict: a.verdict,
        answer: a.answer,
        confidence: a.confidence,
        idk: a.idk,
        source: a.source,
        evidence: a.evidence,
        citations: a.citations ?? [],
        status: a.status,
      })),
    };
  });
}

// ---------- Vendors ----------

interface BackendVendorSummary {
  id: string;
  name: string;
  tenant_id: string;
  document_count: number;
  last_updated: string | null;
  overall_score: number;
  domain_scores: Record<string, number>;
  answered_count: number;
  idk_count: number;
  expected_total: number;
}

export async function getVendors(tenantId: string): Promise<Vendor[]> {
  const res = await request<{ vendors: BackendVendorSummary[] }>(
    `/api/vendors?tenant_id=${encodeURIComponent(tenantId)}`,
  );
  return res.vendors.map(toVendor);
}

export interface VendorDetail extends Vendor {
  answered_count: number;
  idk_count: number;
  expected_total: number;
  documents: TrustDocument[];
  answers: (QueryAnswer & { document_id: string })[];
}

export async function getVendor(vendorId: string, tenantId: string): Promise<VendorDetail> {
  const raw = await request<
    BackendVendorSummary & {
      documents: Array<{
        id: string;
        filename: string;
        doc_version: number;
        page_count: number;
        status: string;
        created_at: string | null;
      }>;
      answers: Array<{
        question_id: string;
        question: string;
        domain: string;
        verdict: QueryAnswer["verdict"];
        answer: string | null;
        confidence: number;
        idk: boolean;
        source: QueryAnswer["source"];
        evidence: QueryAnswer["evidence"];
        citations: QueryAnswer["citations"];
        status: QueryAnswer["status"];
        document_id: string;
      }>;
    }
  >(`/api/vendors/${encodeURIComponent(vendorId)}?tenant_id=${encodeURIComponent(tenantId)}`);

  const base = toVendor(raw);
  return {
    ...base,
    answered_count: raw.answered_count,
    idk_count: raw.idk_count,
    expected_total: raw.expected_total,
    documents: raw.documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      vendor_id: vendorId,
      vendor_name: base.name,
      tenant_id: tenantId,
      uploaded_at: d.created_at ?? new Date().toISOString(),
      status: d.status === "ready" ? "ready" : d.status === "failed" ? "failed" : "processing",
      pages: d.page_count,
    })),
    answers: raw.answers,
  };
}

function toVendor(s: BackendVendorSummary): Vendor {
  return {
    id: s.id,
    name: s.name,
    tenant_id: s.tenant_id,
    overall_score: s.overall_score,
    domain_scores: s.domain_scores,
    document_count: s.document_count,
    last_updated: s.last_updated ?? new Date().toISOString(),
  };
}

// ---------- Stats ----------

export interface DashboardStats {
  documents: number;
  vendors: number;
  pendingReviews: number;
  openConflicts: number;
}

export function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  return request(`/api/stats?tenant_id=${encodeURIComponent(tenantId)}`);
}

// ---------- Conflicts ----------

interface BackendConflict {
  id: string;
  tenant_id: string;
  vendor_id: string;
  question_id: string;
  old_document_id: string;
  new_document_id: string;
  old_answer: string | null;
  new_answer: string | null;
  old_confidence: number;
  new_confidence: number;
  conflict_type: string;
  status: string;
  created_at: string | null;
}

export async function getConflicts(tenantId: string): Promise<Conflict[]> {
  const res = await request<{ conflicts: BackendConflict[] }>(
    `/api/conflicts?tenant_id=${encodeURIComponent(tenantId)}`,
  );
  // Until Delta Engine is wired in Phase 2, the backend returns no conflicts.
  // Map the sparse backend shape into the richer UI Conflict shape with placeholders.
  return res.conflicts.map((c) => ({
    id: c.id,
    vendor_id: c.vendor_id,
    question: c.question_id,
    old_answer: c.old_answer ?? "",
    new_answer: c.new_answer ?? "",
    old_evidence: {
      chunk_id: `${c.id}-old`,
      document_id: c.old_document_id,
      page_number: 1,
      text: c.old_answer ?? "",
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      span_bboxes: [],
      page_width: 612,
      page_height: 792,
      relevance_score: 0,
    },
    new_evidence: {
      chunk_id: `${c.id}-new`,
      document_id: c.new_document_id,
      page_number: 1,
      text: c.new_answer ?? "",
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      span_bboxes: [],
      page_width: 612,
      page_height: 792,
      relevance_score: 0,
    },
    confidence_delta: c.new_confidence - c.old_confidence,
    status: c.status === "accepted_new" ? "accepted_new" : c.status === "accepted_old" ? "accepted_old" : "unresolved",
  }));
}

// ---------- Share links ----------

export interface CreateShareRequest {
  tenant_id: string;
  document_id: string;
  edits: Record<string, { verdict: "YES" | "NO" | "N_A"; answer: string }>;
}

export async function createShareLink(req: CreateShareRequest): Promise<{ token: string }> {
  return request("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export interface SharedReport {
  token: string;
  document: {
    id: string;
    filename: string;
    vendor_id: string;
    page_count: number;
    created_at: string | null;
  };
  total: number;
  answers: QueryAnswer[];
}

export async function getSharedReport(token: string): Promise<SharedReport> {
  const raw = await request<{
    token: string;
    document: SharedReport["document"];
    total: number;
    answers: Array<{
      question_id: string;
      question: string;
      domain: string;
      verdict: QueryAnswer["verdict"];
      answer: string | null;
      confidence: number;
      idk: boolean;
      source: QueryAnswer["source"];
      evidence: QueryAnswer["evidence"];
      citations: QueryAnswer["citations"];
      status: QueryAnswer["status"];
    }>;
  }>(`/api/share/${encodeURIComponent(token)}`);
  return {
    token: raw.token,
    document: raw.document,
    total: raw.total,
    answers: raw.answers.map((a) => ({
      ...a,
      citations: a.citations ?? [],
    })),
  };
}

// ---------- Query (RAG) ----------

export interface QueryRequest {
  question: string;
  tenant_id: string;
  document_id?: string;
  top_k?: number;
}

export function queryRag(req: QueryRequest): Promise<QueryAnswer> {
  return request("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  }).then((r) => {
    const raw = r as {
      question: string;
      answer: string | null;
      confidence: number;
      idk: boolean;
      evidence: QueryAnswer["evidence"];
    };
    // On-demand RAG only returns the hero fields; fill UI-only and verdict defaults.
    return {
      question_id: crypto.randomUUID(),
      question: raw.question,
      domain: "",
      verdict: raw.idk ? "N_A" : "YES",
      answer: raw.answer,
      confidence: raw.confidence,
      idk: raw.idk,
      source: "pdf",
      evidence: raw.evidence,
      citations: [],
      status: "pending_review",
    } satisfies QueryAnswer;
  });
}
