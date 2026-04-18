import type {
  BBox,
  Conflict,
  EvidenceChunk,
  QueryAnswer,
  Tenant,
  TrustDocument,
  Vendor,
} from "./types";
import { DOMAINS } from "./types";

const delay = (min = 200, max = 800) =>
  new Promise<void>((r) => setTimeout(r, Math.floor(min + Math.random() * (max - min))));

// ---------- Tenants ----------
const tenants: Tenant[] = [
  { id: "t-acme", name: "Acme Corp", industry: "FinTech", vendor_count: 5, color: "signature" },
  { id: "t-globex", name: "Globex Ltd", industry: "Healthcare", vendor_count: 5, color: "verified" },
  { id: "t-initech", name: "Initech Inc.", industry: "SaaS", vendor_count: 5, color: "warning" },
];

// ---------- Vendors ----------
const vendorNames = ["Stripe", "Datadog", "Cloudflare", "Snowflake", "Okta"];

function buildDomainScores(seed: number): Record<string, number> {
  const out: Record<string, number> = {};
  DOMAINS.forEach((d, i) => {
    const v = 55 + ((seed * 13 + i * 17) % 42);
    out[d] = Math.min(99, v);
  });
  return out;
}

const vendors: Vendor[] = tenants.flatMap((t, ti) =>
  vendorNames.map((name, vi) => {
    const seed = ti * 5 + vi + 1;
    const scores = buildDomainScores(seed);
    const overall = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / DOMAINS.length,
    );
    return {
      id: `${t.id}-v-${vi}`,
      name,
      overall_score: overall,
      domain_scores: scores,
      document_count: 2 + (seed % 4),
      last_updated: new Date(Date.now() - seed * 86_400_000).toISOString(),
      tenant_id: t.id,
    };
  }),
);

// ---------- Documents ----------
const documents: TrustDocument[] = vendors.flatMap((v, i) => [
  {
    id: `doc-${v.id}-soc2`,
    filename: `${v.name}-SOC2-Type-II-2024.pdf`,
    vendor_id: v.id,
    vendor_name: v.name,
    tenant_id: v.tenant_id,
    uploaded_at: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    status: "ready",
    pages: 84,
  },
  {
    id: `doc-${v.id}-policy`,
    filename: `${v.name}-Information-Security-Policy.pdf`,
    vendor_id: v.id,
    vendor_name: v.name,
    tenant_id: v.tenant_id,
    uploaded_at: new Date(Date.now() - (i + 2) * 7200_000).toISOString(),
    status: i % 6 === 0 ? "processing" : "ready",
    pages: 32,
  },
]);

// ---------- Answers ----------
const QUESTION_BANK: { domain: string; q: string; a: string }[] = [
  {
    domain: "Access Control & Identity",
    q: "Does the vendor enforce multi-factor authentication for all privileged accounts?",
    a: "Yes. All privileged production access requires hardware-backed MFA (WebAuthn/FIDO2) enforced via Okta. Console access without MFA is denied at the IdP layer and logged.",
  },
  {
    domain: "Access Control & Identity",
    q: "Are user access reviews performed on a defined cadence?",
    a: "Quarterly access reviews are performed by system owners. Reviews are tracked in a centralized GRC platform with evidence retained for 7 years per SOC 2 CC6.3.",
  },
  {
    domain: "Data Security & Encryption",
    q: "Is customer data encrypted at rest and in transit?",
    a: "Customer data is encrypted at rest using AES-256 (per CMK in AWS KMS) and in transit using TLS 1.2+. Internal service-to-service traffic uses mTLS.",
  },
  {
    domain: "Data Security & Encryption",
    q: "How are encryption keys managed and rotated?",
    a: "Keys are managed in AWS KMS with annual rotation enforced by policy. Customer-managed keys (BYOK) are supported for Enterprise tier.",
  },
  {
    domain: "Incident Response",
    q: "Does the organization maintain a documented incident response plan?",
    a: "Yes. The IR plan is reviewed annually and tested via tabletop exercises twice per year. Severity tiers, on-call rotations, and customer notification SLAs (≤72h) are defined.",
  },
  {
    domain: "Business Continuity",
    q: "What is the documented RTO and RPO for production systems?",
    a: "Tier-1 services target RTO ≤ 4 hours and RPO ≤ 15 minutes. DR drills are executed quarterly with results retained as audit evidence.",
  },
  {
    domain: "Vulnerability Management",
    q: "How frequently are vulnerability scans performed?",
    a: "Authenticated scans run weekly across production and corporate networks. Critical CVEs are remediated within 7 days; high within 30 days per the VM policy.",
  },
  {
    domain: "Compliance & Audit",
    q: "Has the vendor completed a SOC 2 Type II audit in the last 12 months?",
    a: "Yes. SOC 2 Type II report covers October 2023 – September 2024 with no exceptions noted. Report available under NDA.",
  },
  {
    domain: "Vendor & Supply Chain",
    q: "Is there a formal third-party risk management program?",
    a: "Yes. All sub-processors complete a security questionnaire and SOC 2 review prior to onboarding. The sub-processor list is published and updated within 30 days of changes.",
  },
  {
    domain: "Infrastructure & Ops",
    q: "Are production systems hosted in compliant data centers?",
    a: "Production runs on AWS in us-east-1 and eu-west-1. AWS maintains SOC 1/2/3, ISO 27001, and PCI-DSS attestations covering the underlying infrastructure.",
  },
  {
    domain: "Access Control & Identity",
    q: "Are shared accounts permitted for production access?",
    a: null as unknown as string, // IDK
  },
  {
    domain: "Vendor & Supply Chain",
    q: "Does the vendor maintain a Software Bill of Materials (SBOM) for each release?",
    a: null as unknown as string, // IDK
  },
];

function makeBBox(seed: number): BBox {
  // Deterministic-ish bbox within an US-Letter page (612 x 792)
  const x0 = 60 + (seed * 17) % 200;
  const y0 = 120 + (seed * 29) % 380;
  const w = 280 + (seed * 11) % 200;
  const h = 38 + (seed * 7) % 60;
  return { x0, y0, x1: Math.min(552, x0 + w), y1: Math.min(740, y0 + h) };
}

function makeEvidence(documentId: string, seed: number, text: string): EvidenceChunk {
  const bbox = makeBBox(seed);
  return {
    chunk_id: `chunk-${documentId}-${seed}`,
    document_id: documentId,
    page_number: 1 + (seed % 12),
    text,
    bbox,
    span_bboxes: [bbox],
    page_width: 612,
    page_height: 792,
    relevance_score: 0.6 + ((seed % 35) / 100),
  };
}

const answersByVendor: Record<string, QueryAnswer[]> = {};

vendors.forEach((v, vi) => {
  const docId = `doc-${v.id}-soc2`;
  const list: QueryAnswer[] = QUESTION_BANK.map((row, qi) => {
    const seed = vi * 31 + qi * 7 + 3;
    const idk = row.a === null;
    const baseConf = idk ? 0.18 + ((seed % 15) / 100) : 0.45 + ((seed % 50) / 100);
    const confidence = Math.min(0.97, Math.max(0.05, baseConf));
    const status: QueryAnswer["status"] =
      qi % 5 === 0 ? "verified" : qi % 7 === 0 ? "published" : "pending_review";
    return {
      question_id: `${v.id}-q-${qi}`,
      question: row.q,
      domain: row.domain,
      answer: idk ? null : row.a,
      confidence,
      idk,
      evidence: idk
        ? []
        : [
            makeEvidence(
              docId,
              seed,
              row.a.length > 180 ? row.a.slice(0, 180) + "…" : row.a,
            ),
          ],
      status,
    };
  });
  answersByVendor[v.id] = list;
});

// ---------- Conflicts ----------
const conflicts: Conflict[] = vendors.slice(0, 3).map((v, i) => {
  const docId = `doc-${v.id}-soc2`;
  const oldText = "Encryption keys are rotated every 24 months under the customer-managed schedule.";
  const newText = "Encryption keys are rotated every 12 months; emergency rotation within 24h on suspected compromise.";
  return {
    id: `conflict-${i}`,
    vendor_id: v.id,
    question: "How frequently are encryption keys rotated?",
    old_answer: oldText,
    new_answer: newText,
    old_evidence: makeEvidence(docId, 100 + i, oldText),
    new_evidence: makeEvidence(docId, 200 + i, newText),
    confidence_delta: -0.18 - i * 0.05,
    status: "unresolved",
  };
});

// ---------- API ----------
export async function getTenants(): Promise<Tenant[]> {
  await delay();
  return tenants;
}

export async function getVendors(tenantId: string): Promise<Vendor[]> {
  await delay();
  return vendors.filter((v) => v.tenant_id === tenantId);
}

export async function getVendor(vendorId: string): Promise<Vendor> {
  await delay();
  const v = vendors.find((x) => x.id === vendorId);
  if (!v) throw new Error("Vendor not found");
  return v;
}

export async function getDocuments(tenantId: string): Promise<TrustDocument[]> {
  await delay();
  return documents.filter((d) => d.tenant_id === tenantId);
}

export async function getDocument(documentId: string): Promise<TrustDocument> {
  await delay();
  const d = documents.find((x) => x.id === documentId);
  if (!d) throw new Error("Document not found");
  return d;
}

export async function getAnswers(
  vendorId: string,
  _documentId?: string,
): Promise<QueryAnswer[]> {
  await delay();
  return answersByVendor[vendorId] ?? [];
}

export async function getAnswersByDocument(documentId: string): Promise<{
  document: TrustDocument;
  answers: QueryAnswer[];
}> {
  await delay();
  const document = documents.find((d) => d.id === documentId);
  if (!document) throw new Error("Document not found");
  const answers = answersByVendor[document.vendor_id] ?? [];
  return { document, answers };
}

export async function getConflicts(tenantId: string): Promise<Conflict[]> {
  await delay();
  const vendorIds = new Set(vendors.filter((v) => v.tenant_id === tenantId).map((v) => v.id));
  return conflicts.filter((c) => vendorIds.has(c.vendor_id));
}

export async function getDashboardStats(tenantId: string) {
  await delay(150, 400);
  const docs = documents.filter((d) => d.tenant_id === tenantId);
  const vends = vendors.filter((v) => v.tenant_id === tenantId);
  const ans = vends.flatMap((v) => answersByVendor[v.id] ?? []);
  return {
    documents: docs.length,
    vendors: vends.length,
    pendingReviews: ans.filter((a) => a.status === "pending_review").length,
    openConflicts: conflicts.filter((c) => vends.some((v) => v.id === c.vendor_id)).length,
  };
}
