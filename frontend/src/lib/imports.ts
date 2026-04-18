import type { QueryAnswer, Vendor } from "./types";

const KEY_PREFIX = "verifai:imports:";
const IMPORT_ID_PREFIX = "imported:";

export interface ImportedVendor {
  id: string;
  token: string;
  name: string;
  filename: string;
  imported_at: string;
  overall_score: number;
  domain_scores: Record<string, number>;
  document_count: number;
}

export function isImportedVendorId(id: string): boolean {
  return id.startsWith(IMPORT_ID_PREFIX);
}

export function tokenFromImportedId(id: string): string | null {
  if (!isImportedVendorId(id)) return null;
  return id.slice(IMPORT_ID_PREFIX.length);
}

function storageKey(tenantId: string): string {
  return `${KEY_PREFIX}${tenantId}`;
}

export function getImports(tenantId: string): ImportedVendor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as ImportedVendor[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeImports(tenantId: string, items: ImportedVendor[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(tenantId), JSON.stringify(items));
}

export function computeScoresFromAnswers(answers: QueryAnswer[]): {
  overall_score: number;
  domain_scores: Record<string, number>;
} {
  if (answers.length === 0) return { overall_score: 0, domain_scores: {} };

  const answered = answers.filter((a) => !a.idk).length;
  const overall_score = Math.round((answered / answers.length) * 100);

  const byDomain: Record<string, { total: number; answered: number }> = {};
  for (const a of answers) {
    if (!byDomain[a.domain]) byDomain[a.domain] = { total: 0, answered: 0 };
    byDomain[a.domain].total += 1;
    if (!a.idk) byDomain[a.domain].answered += 1;
  }
  const domain_scores: Record<string, number> = {};
  for (const [d, { total, answered }] of Object.entries(byDomain)) {
    domain_scores[d] = total === 0 ? 0 : Math.round((answered / total) * 100);
  }
  return { overall_score, domain_scores };
}

export function addImport(
  tenantId: string,
  payload: {
    token: string;
    vendorName: string;
    filename: string;
    answers: QueryAnswer[];
  },
): ImportedVendor {
  const { overall_score, domain_scores } = computeScoresFromAnswers(payload.answers);
  const item: ImportedVendor = {
    id: `${IMPORT_ID_PREFIX}${payload.token}`,
    token: payload.token,
    name: payload.vendorName,
    filename: payload.filename,
    imported_at: new Date().toISOString(),
    overall_score,
    domain_scores,
    document_count: 1,
  };
  const existing = getImports(tenantId).filter((x) => x.token !== payload.token);
  writeImports(tenantId, [item, ...existing]);
  return item;
}

export function removeImport(tenantId: string, token: string): void {
  writeImports(tenantId, getImports(tenantId).filter((x) => x.token !== token));
}

export function importedVendorToVendor(
  imp: ImportedVendor,
  tenantId: string,
): Vendor {
  return {
    id: imp.id,
    name: imp.name,
    tenant_id: tenantId,
    overall_score: imp.overall_score,
    domain_scores: imp.domain_scores,
    document_count: imp.document_count,
    last_updated: imp.imported_at,
  };
}
