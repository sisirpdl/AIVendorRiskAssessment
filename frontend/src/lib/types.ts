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

export interface Conflict {
  id: string;
  vendor_id: string;
  question: string;
  old_answer: string;
  new_answer: string;
  old_evidence: EvidenceChunk;
  new_evidence: EvidenceChunk;
  confidence_delta: number;
  status: "unresolved" | "accepted_new" | "accepted_old";
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
