# AI Supply Chain Security Platform — Hackathon MVP Plan

## Context

Building an AI-native Vendor Risk Assessment / Supply Chain Security platform for the Ignite Hackathon. Must run entirely locally (localhost + Docker) while hitting external LLM APIs. Target audience: IT/MSP companies. Two user modes: MSP Seller (uploads Trust Packages, reviews AI answers) and Auditor/Buyer (views verified security posture). Three technical differentiators: Visual Bounding Box Verification, Delta Engine conflict detection, and strict "Information Not Found" hallucination prevention.

**Interrogation findings:**
- Team: React/Next.js daily drivers — full react-pdf bbox overlay is appropriate
- **CRITICAL RISK: PyMuPDF NOT tested on local machines** — must verify before any other work
- Chunking: Page-bounded + token limit (confirmed)
- LLM: Claude (claude-sonnet-4-6) + OpenAI embeddings (two API keys = two failure points — sentence-transformers fallback needed)
- Multi-tenancy: No real auth. Client-switcher dropdown with hardcoded tenants (Acme / Globex / Initech)
- Question bank: CAIQ v4 subset (~50 curated questions) — more credible than 20, but requires pre-computation strategy for delta engine
- Design: shadcn/ui + Tailwind + Framer Motion (premium feel with minimum custom CSS)
- Scope: 2-3 devs, 24-48 hours. Full plan including Delta Engine is achievable with parallel workstreams

---

## STEP 0 — Pre-Work (Do Before Writing Any Code)

```bash
# Run this on every team member's machine before touching the codebase:
pip install pymupdf
python -c "import fitz; doc = fitz.open('test.pdf'); print(doc[0].get_text('dict')['blocks'][0])"
```

If this fails on Windows: install Visual C++ Redistributable 2015-2022. If it still fails, fall back to `pip install pymupdf --no-binary pymupdf` or use Docker exclusively for the backend.

Also verify: `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are set and valid.

---

## Multi-Tenancy (Demo Fake — Zero Auth)

**No login, no JWT, no NextAuth.** Tenancy is cosmetic but functional.

```typescript
// frontend/src/lib/tenants.ts — hardcoded demo tenants
export const DEMO_TENANTS = [
  { id: "acme",    name: "Acme Corp",     industry: "FinTech",   vendor_count: 12 },
  { id: "globex",  name: "Globex Ltd",    industry: "Healthcare", vendor_count: 8 },
  { id: "initech", name: "Initech Inc.",  industry: "SaaS",      vendor_count: 5 },
];
```

- Top-right `<TenantSwitcher />` dropdown persists selection to `localStorage["activeTenantId"]`
- Every API call passes `?tenant_id=acme` as a query param
- Backend filters ChromaDB queries with `where={"tenant_id": tenant_id}` and SQLite rows with `WHERE tenant_id = ?`
- Add `tenant_id` column to ChromaDB metadata and every SQLite table
- On first load, default to `"acme"`

**For the Buyer side:** URL carries the tenant (`/buyer/acme/vault`). Switching tenants = switching vendor lists. No auth barrier.

**Demo effect:** Judges see "managing multiple clients" narrative working. If anyone asks about real auth, say "NextAuth integration is a 2-hour task — we prioritized the AI verification flow."

---

## Design System — shadcn/ui + Tailwind + Framer Motion

**Install:**
```bash
npx shadcn@latest init   # choose: New York style, Slate base, CSS vars, dark default
npx shadcn@latest add button card dialog dropdown-menu tabs badge progress toast sheet skeleton separator
npm i framer-motion react-pdf react-dropzone lucide-react
```

**Palette (Tailwind config):**
- Base: `bg-slate-950`, `bg-slate-900` (surfaces), `bg-slate-800` (elevated)
- Accent: `text-yellow-300` / `border-yellow-400` for bbox + verified badges
- Success: `emerald-400`, Warning: `amber-400`, Danger: `rose-500`
- IDK state: `slate-500` dashed border + muted text (visually recedes)

**Critical motion moments (Framer Motion):**
1. **Split-screen open** — `AnimatePresence` on the right panel, `initial={{ x: "100%", opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}`, `transition={{ type: "spring", damping: 25 }}`
2. **Bbox appear** — scale from 0.92 → 1 with a subtle yellow glow pulse (`boxShadow` animation 0 → 12px → 6px)
3. **Answer card hover** — lift 2px with soft shadow, cursor pointer
4. **Confidence bar fill** — animate width from 0 → target over 600ms on mount

**Do NOT:** use default shadcn `Card` with zero customization everywhere — judges spot vanilla shadcn. Add subtle grid backgrounds (`bg-[radial-gradient(...)]`), a fixed-width monospace for confidence numbers, and one signature element (e.g., neon yellow vertical bar on the active answer).

---

## Directory Structure

```
AIVendorRiskAssessment/
├── frontend/                    # Next.js 14 App Router
│   ├── src/app/
│   │   ├── page.tsx             # Role picker (Seller / Buyer)
│   │   ├── seller/
│   │   │   ├── page.tsx         # Seller dashboard
│   │   │   ├── upload/page.tsx
│   │   │   ├── review/[docId]/page.tsx   # Split-screen
│   │   │   └── conflicts/page.tsx        # Delta Engine queue
│   │   └── buyer/
│   │       ├── page.tsx         # Trust Vault
│   │       └── assess/[vendorId]/page.tsx
│   ├── src/components/
│   │   ├── shared/PDFViewer.tsx          # react-pdf wrapper
│   │   ├── shared/BBoxOverlay.tsx        # Neon yellow highlight
│   │   ├── seller/SplitScreenReview.tsx
│   │   ├── seller/ConflictQueue.tsx
│   │   └── buyer/TrustVault.tsx
│   ├── src/lib/
│   │   ├── types.ts             # EvidenceChunk, QueryAnswer interfaces
│   │   ├── pdfCoords.ts         # pdfPointsToCanvasPx() transform
│   │   └── api.ts               # Typed fetch wrappers
│   └── package.json
│
├── backend/
│   ├── main.py                  # FastAPI entry + CORS middleware
│   ├── config.py                # Env vars, constants
│   ├── database.py              # SQLite via SQLAlchemy
│   ├── routers/
│   │   ├── documents.py         # Upload, list, serve PDF file
│   │   ├── query.py             # RAG query + bbox response
│   │   ├── clients.py           # MSP client management
│   │   └── delta.py             # Conflict detection + resolution
│   ├── services/
│   │   ├── pdf_extractor.py     # PyMuPDF → TextSpan list with bbox
│   │   ├── chunker.py           # Page-bounded chunker, union bbox
│   │   ├── embedder.py          # OpenAI embeddings + sentence-transformers fallback
│   │   ├── vector_store.py      # ChromaDB PersistentClient
│   │   ├── llm.py               # Claude claude-sonnet-4-6, IDK enforcement
│   │   └── delta_engine.py      # Version diff logic
│   ├── data/
│   │   ├── pdfs/                # Uploaded raw PDFs (local filesystem)
│   │   ├── chroma_db/           # ChromaDB persistent store
│   │   └── vendor_risk.db       # SQLite
│   ├── requirements.txt
│   └── .env
│
├── docker-compose.yml
└── .env.example
```

---

## Critical Data Flow: Bounding Box Pipeline

```
PDF Upload
  → PyMuPDF fitz.open() → page.get_text("dict")
  → TextSpan: { text, page_number, bbox[x0,y0,x1,y1], page_width, page_height }
  → Chunker: group by page (NEVER cross pages), max ~400 tokens
  → Chunk: { text, page_number, bbox (union), span_bboxes (individual), page_width, page_height, content_hash }
  → OpenAI text-embedding-3-small → float[] vector
  → ChromaDB upsert: id=chunk_id, embedding=vector, metadata={bbox as JSON string, span_bboxes as JSON string, page_number, page_width, page_height, doc_version}

RAG Query
  → Embed question → ChromaDB query top-5
  → Deserialize bbox JSON strings → EvidenceChunk[]
  → LLM (claude-sonnet-4-6) with IDK system prompt → answer or null
  → QueryAnswer { answer, confidence, idk: bool, evidence: EvidenceChunk[] }

Frontend Render
  → Click answer → extract evidence[0].page_number, bbox, page_width, page_height
  → Navigate PDF.js to correct page
  → pdfPointsToCanvasPx(bbox, page_width, page_height, canvasWidth, canvasHeight)
  → CSS absolute-positioned div with neon yellow border over PDF canvas
```

### Coordinate System (Critical)
PyMuPDF fitz `get_text("dict")` uses **top-left origin, PDF points** (1pt = 1/72 inch). PDF.js canvas also uses top-left origin after rendering. They match — **no Y-axis flip needed**. Only scaling required:

```typescript
// frontend/src/lib/pdfCoords.ts
export function pdfPointsToCanvasPx(bbox, pageWidthPts, pageHeightPts, canvasW, canvasH) {
  const scaleX = canvasW / pageWidthPts;
  const scaleY = canvasH / pageHeightPts;
  return {
    left:   bbox.x0 * scaleX,
    top:    bbox.y0 * scaleY,
    width:  (bbox.x1 - bbox.x0) * scaleX,
    height: (bbox.y1 - bbox.y0) * scaleY,
  };
}
```

**Demo-critical test:** After wiring the first PDF, render page 1, click a known answer, verify the yellow box lands on the correct word. Do this before the hackathon presentation.

---

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/documents/upload` | Multipart PDF upload → triggers extraction + embedding pipeline |
| GET | `/api/documents/{doc_id}/file` | Serve raw PDF binary (for react-pdf to render) |
| POST | `/api/query` | RAG query → `QueryAnswer` with `EvidenceChunk[]` including bbox |
| GET | `/api/vendors/{id}/posture` | Full questionnaire snapshot for Buyer view |
| POST | `/api/delta/compare` | Trigger diff between two document versions |
| GET | `/api/delta/conflicts/{vendor_id}` | Unresolved conflict queue |
| POST | `/api/delta/resolve/{conflict_id}` | Accept new/old or flag |

### QueryAnswer response contract (TypeScript)

```typescript
interface EvidenceChunk {
  chunk_id: string;
  document_id: string;
  page_number: number;
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  span_bboxes: { x0: number; y0: number; x1: number; y1: number }[];
  page_width: number;
  page_height: number;
  relevance_score: number;
}

interface QueryAnswer {
  question: string;
  answer: string | null;   // null = IDK
  confidence: number;      // 0.0–1.0
  idk: boolean;
  evidence: EvidenceChunk[];
}
```

---

## ChromaDB Metadata Schema (per chunk)

ChromaDB requires flat metadata — serialize all arrays/objects as JSON strings.

| Field | Type | Notes |
|-------|------|-------|
| `document_id` | str | Source document |
| `vendor_id` | str | Tenant isolation |
| `doc_version` | int | For delta comparison |
| `page_number` | int | PDF.js page navigation |
| `bbox` | str (JSON) | `"[x0,y0,x1,y1]"` — union bbox |
| `span_bboxes` | str (JSON) | `"[[x0,y0,x1,y1],...]"` — per-span |
| `page_width` | float | PyMuPDF page.rect.width |
| `page_height` | float | PyMuPDF page.rect.height |
| `content_hash` | str | SHA-256 for delta detection |

**Always deserialize with `json.loads()` in the response layer.**

---

## LLM — Strict IDK Enforcement

```python
# backend/services/llm.py
SYSTEM_PROMPT = """You are a strict security compliance analyst.
Answer ONLY from the provided context. Never use prior knowledge.
If the context does not contain enough information, respond with exactly: INFORMATION_NOT_FOUND
Be concise. Maximum 2 sentences. Never speculate."""

# Returns (answer: str | None, confidence: float)
# answer=None triggers idk=True in the response
```

Model: `claude-sonnet-4-6`. Confidence threshold: `0.4` (below → IDK).

Fallback embeddings: if `OPENAI_API_KEY` is unavailable, swap `embedder.py` to use `sentence-transformers/all-MiniLM-L6-v2` (local, ~80MB download, no API needed).

---

## Question Bank — CAIQ v4 Subset (50 questions)

Store in `backend/data/caiq_subset.json` — hand-curate 50 questions from CAIQ v4 covering these domains:

| Domain | Count | Example |
|--------|-------|---------|
| Access Control & Identity | 8 | "Does the vendor enforce MFA for all privileged access?" |
| Data Security & Encryption | 8 | "Is customer data encrypted at rest using AES-256 or stronger?" |
| Incident Response | 6 | "What is the vendor's customer notification SLA for confirmed breaches?" |
| Business Continuity | 5 | "What is the documented RPO and RTO?" |
| Vulnerability Management | 6 | "How frequently does the vendor perform third-party penetration testing?" |
| Compliance & Audit | 7 | "Does the vendor maintain a current SOC 2 Type II report?" |
| Vendor & Supply Chain | 5 | "Does the vendor maintain a public list of subprocessors?" |
| Infrastructure & Ops | 5 | "Are production systems isolated from development environments?" |

Each entry: `{ id, domain, question, keywords: [...], criticality: "high"|"medium"|"low" }`.

**Pre-computation strategy:** On document upload, run ALL 50 questions through the RAG pipeline in a background task (`asyncio.gather` in batches of 10). Store results in a `cached_answers` SQLite table keyed by `(document_id, question_id)`. The Buyer Trust Vault reads from this cache instantly — no on-demand LLM calls during demo.

Estimated pre-compute time: 50 questions × ~1.5s per query (embedding + retrieval + Claude) = **~75 seconds per document**. Start this async right after upload; show progress to user.

---

## Delta Engine

1. On new document upload for a vendor that already has documents, auto-trigger `delta_engine.detect_conflicts(vendor_id, old_version, new_version)`.
2. Read cached answers from `cached_answers` table for both versions (50 questions × 2 versions). **Do not re-run RAG** — use the pre-computed answers.
3. Flag as conflict if: one is IDK and the other isn't, OR keyword flip detected (yes/no, encrypted/unencrypted, dates changed), OR confidence drops >30%, OR cosine similarity of answer embeddings <0.85.
4. Store conflicts in SQLite `conflicts` table with both bbox references.
5. UI shows side-by-side diff with bbox highlight on each version's source PDF.

Because conflict detection reads from cache, it completes in <2 seconds even for 50 questions.

---

## Docker Compose

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ./backend/data:/app/data
    environment:
      - ANTHROPIC_API_KEY
      - OPENAI_API_KEY
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on: [backend]
    command: npm run dev
```

CORS: FastAPI must allow `http://localhost:3000`.

---

## Team Split (2-3 devs, 24-48 hours)

### Dev A — Backend Pipeline Owner
1. Step 0: verify PyMuPDF on own machine + share fix steps in team chat
2. `backend/services/pdf_extractor.py` — extraction + bbox output
3. `backend/services/chunker.py` — page-bounded chunker
4. `backend/services/embedder.py` + `vector_store.py` — OpenAI embeddings + ChromaDB with JSON-serialized bbox metadata
5. `backend/services/llm.py` — Claude IDK enforcement
6. `backend/routers/documents.py` upload + `backend/routers/query.py`
7. CAIQ v4 subset JSON + async pre-compute pipeline writing to `cached_answers` table

### Dev B — Frontend Magic Moment Owner
1. Next.js 14 App Router scaffold + shadcn/ui init + Tailwind theme
2. `frontend/src/lib/pdfCoords.ts` — coordinate transform utility
3. `frontend/src/components/shared/PDFViewer.tsx` + `BBoxOverlay.tsx` (use `ResizeObserver`)
4. `frontend/src/components/seller/SplitScreenReview.tsx` with Framer Motion slide-open
5. `frontend/src/app/seller/upload/page.tsx` + `review/[docId]/page.tsx`
6. Tenant switcher dropdown (hardcoded demo tenants, localStorage persistence)
7. Mock data fallback so frontend is demo-able before backend is wired

### Dev C (if available) — Delta Engine + Buyer Side + Polish
1. `backend/services/delta_engine.py` + `routers/delta.py` (reads from cached_answers)
2. `frontend/src/app/buyer/vault/page.tsx` — Trust Vault grid with vendor cards
3. `frontend/src/app/buyer/assess/[vendorId]/page.tsx` — questionnaire view by domain
4. `frontend/src/components/seller/ConflictQueue.tsx` — side-by-side diff with bbox
5. Confidence bars (Framer Motion fill animation), IDK badges, category scoring
6. Demo PDF preparation: pre-upload, pre-process, pre-edit v2 version
7. End-to-end rehearsal + reset script (`scripts/reset_demo.sh` — wipes chroma_db + data/pdfs + SQLite)

### Daily sync points
- **End of day 1:** PDF upload → chunks in ChromaDB (Dev A), PDF renders with fake bbox (Dev B). Merge and demo the pipeline end-to-end.
- **Mid-day 2:** Full split-screen review flow works with real backend. Begin Delta Engine + Buyer side.
- **End of day 2:** Rehearse demo 5+ times. Reset demo state between runs. Fix any demo-breaking bugs only — no new features.

---

## Implementation Order (If Going Solo)

1. **Verify PyMuPDF works** (Step 0 above) — do this first
2. `backend/services/pdf_extractor.py` — extraction + bbox output
3. `backend/services/chunker.py` — page-bounded chunking
4. `backend/services/vector_store.py` + `embedder.py` — ChromaDB with serialized bbox metadata
5. `backend/routers/documents.py` — upload endpoint + PDF file serving
6. `backend/routers/query.py` — RAG query returning EvidenceChunk[]
7. `frontend/src/lib/pdfCoords.ts` + `BBoxOverlay.tsx` + `PDFViewer.tsx` — the magic moment
8. `frontend/src/components/seller/SplitScreenReview.tsx` — click-to-highlight flow
9. CAIQ pre-compute + Buyer Trust Vault view
10. `backend/services/delta_engine.py` + `routers/delta.py` — conflicts queue (CAN BE CUT if time-starved)
11. `frontend/src/components/seller/ConflictQueue.tsx` — diff view (CAN BE CUT if time-starved)
12. Polish: confidence bars, IDK badges, overall scoring, tenant switcher

---

## Demo Flow (4-minute script)

1. Open `localhost:3000` → click "MSP / Seller"
2. Drag-drop pre-processed SOC 2 PDF → processing spinner (~10-30s, or pre-loaded)
3. Click "Review Answers" → split-screen opens with questionnaire answers
4. Click any answer → PDF jumps to correct page + **neon yellow bbox appears** over the exact proof text
5. Show an "Information Not Found" badge for a question not in the PDF
6. Click "Publish to Client"
7. Switch to `/buyer` → Trust Vault with vendor card + confidence scores
8. Upload v2 of the PDF → navigate to Conflicts tab → show changed answer flagged
9. Show side-by-side diff with bbox on both versions → click "Accept New Version"

**Pre-load the demo PDF before presenting.** Processing time is the biggest audience-patience risk.

---

## Technical Risks (Ranked)

| Risk | Severity | Mitigation |
|------|----------|------------|
| PyMuPDF not installed | CRITICAL | Verify Step 0 on all machines before writing code |
| Bbox coordinate mismatch (wrong scale) | HIGH | Write a visual test: render page 1, overlay known bbox, screenshot-verify |
| react-pdf canvas timing (overlay mis-sized) | HIGH | Use ResizeObserver on canvas, not onRenderSuccess |
| OpenAI embeddings API down mid-demo | MEDIUM | Pre-load sentence-transformers fallback; pre-embed demo PDFs |
| ChromaDB metadata serialization | MEDIUM | Always json.loads() bbox fields; add assertion in response layer |
| Large PDF processing time during live demo | MEDIUM | Pre-process all demo PDFs; show WebSocket progress bar |
| Delta false positives (phrasing noise) | LOW | Normalize text before keyword comparison; semantic similarity threshold 0.85 |

---

## Verification Checklist

- [ ] `python -c "import fitz"` succeeds on all machines
- [ ] Backend starts: `uvicorn main:app --reload` at port 8000
- [ ] Upload a real SOC 2 PDF → chunks visible in ChromaDB with `tenant_id` metadata
- [ ] Query returns EvidenceChunk with non-null bbox fields
- [ ] CAIQ pre-compute runs async, populates `cached_answers` table (~75s per doc)
- [ ] Tenant switcher changes data visible in both Seller and Buyer views
- [ ] Frontend renders PDF + bbox overlay on correct page (visual test on a known word)
- [ ] IDK state renders correctly for an out-of-scope question (dashed border, muted color)
- [ ] Split-screen slide-open animation feels smooth (Framer Motion, 60fps)
- [ ] Upload v2 PDF → conflicts queue populates in under 2 seconds (reads from cache)
- [ ] `scripts/reset_demo.sh` wipes state so demo can be re-run from scratch
- [ ] Docker Compose `up` starts both services cleanly
- [ ] Full demo flow runs end-to-end in under 5 minutes
- [ ] Rehearsed at least 3 times with deliberate mistakes + recovery
