export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface EvidenceChunk {
  chunk_id: string;
  document_id: string;
  page_number: number;
  text: string;
  bbox: BBox;
  span_bboxes: BBox[];
  page_width: number;
  page_height: number;
  relevance_score: number;
}

export type AnswerStatus = "pending_review" | "verified" | "published";
export type Verdict = "YES" | "NO" | "N_A";
export type AnswerSource = "pdf" | "web" | "manual";

export interface Citation {
  url: string;
  title: string;
}

export interface QueryAnswer {
  question_id: string;
  question: string;
  domain: string;
  verdict: Verdict;
  answer: string | null;
  confidence: number;
  idk: boolean;
  source: AnswerSource;
  evidence: EvidenceChunk[];
  citations: Citation[];
  status: AnswerStatus;
}

export interface Vendor {
  id: string;
  name: string;
  logo_url?: string;
  overall_score: number;
  domain_scores: Record<string, number>;
  document_count: number;
  last_updated: string;
  tenant_id: string;
}

export type ConflictType = "idk_flip" | "keyword_flip" | "confidence_drop" | "semantic";
export type ConflictSeverity = "high" | "medium" | "low";
export type ConflictStatus = "unresolved" | "accepted_new" | "accepted_old";

export interface Conflict {
  id: string;
  vendor_id: string;
  vendor_name: string;
  question_id: string;
  question: string;
  domain: string;
  old_answer: string | null;
  new_answer: string | null;
  old_verdict: Verdict;
  new_verdict: Verdict;
  old_confidence: number;
  new_confidence: number;
  old_document_id: string;
  new_document_id: string;
  conflict_type: ConflictType;
  severity: ConflictSeverity;
  confidence_delta: number;
  status: ConflictStatus;
  created_at: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  vendor_count: number;
  color: string; // dot color (oklch via tailwind classes handled separately)
}

export interface TrustDocument {
  id: string;
  filename: string;
  vendor_id: string;
  vendor_name: string;
  tenant_id: string;
  uploaded_at: string;
  status: "processing" | "ready" | "failed";
  pages: number;
}

export const DOMAINS = [
  "Access Control & Identity",
  "Data Security & Encryption",
  "Incident Response",
  "Business Continuity",
  "Vulnerability Management",
  "Compliance & Audit",
  "Vendor & Supply Chain",
  "Infrastructure & Ops",
] as const;

export type Domain = (typeof DOMAINS)[number];
