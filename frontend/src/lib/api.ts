import type { QueryAnswer, Tenant, TrustDocument } from "./types";

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
    const raw = r as Omit<QueryAnswer, "question_id" | "domain" | "status"> & {
      question: string;
    };
    // Backend QueryAnswer lacks the UI-only fields; fill them.
    return {
      question_id: crypto.randomUUID(),
      question: raw.question,
      domain: "",
      answer: raw.answer,
      confidence: raw.confidence,
      idk: raw.idk,
      evidence: raw.evidence,
      status: "pending_review",
    } satisfies QueryAnswer;
  });
}
