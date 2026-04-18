# What's Done So Far

> Running log of completed hackathon work. Update at the end of each work session. Keep entries short — this is a checklist, not a narrative.

## ✅ Phase 0 — Planning & Research

- [x] Repo initialized and pulled from `github.com/sisirpdl/AIVendorRiskAssessment`
- [x] Local branch renamed to `main` and aligned with `origin/main`
- [x] [PLAN.md](PLAN.md) finalized — **Route 1 scope locked** (RAG + Claude cloud LLM only)
  - Route 2 (fine-tuned local LLM) → out of scope for MVP
  - Route 3 (federated learning) → out of scope for MVP
- [x] Question bank choice: **CAIQ v4.0.2** (not SIG) — free, open, industry-standard
- [x] XLSX ingestion path documented as a stretch goal in [PLAN.md](PLAN.md)
- [x] Demo corpus sources identified (CSA STAR Registry, A-LIGN, Schellman)

## ✅ Phase 1 — Demo Corpus Acquisition

- [x] **CAIQ v4.0.2** files downloaded to `CAIQv4.0.2/`
  - `CSA_CAIQ_v4.0.2_Full.xlsx` — blank template (source for the 50-question bank)
  - `Accredify CAIQv4.0.2_STAR-Security-Questionnaire.xlsx` — filled example
  - `star-security-questionnaire.xlsx` — filled example
- [x] **SOC 2 sample reports** downloaded to `so2_reports/`
  - `Matillion-SOC-2-Type-2-FINAL-Report.pdf`
  - `SysAid_SOC2TypeII_FinalReport2024.pdf`
  - `legitdoc.pdf`
- [ ] Prepare edited SOC 2 v1 vs v2 copy for the Delta Engine demo *(deferred)*

## ✅ Phase 2 — Environment Verification

- [x] **Step 0: PyMuPDF verification on Windows** — PASSED
  - All 3 SOC 2 PDFs extractable: Matillion (129pg), SysAid (57pg), legitdoc (3pg)
  - Bbox coordinates present for every text span
  - Page sizes: 612×792 pt (US Letter) and 595×842 pt (A4) — both handled
- [x] **Python 3.12.10** installed via winget and venv rebuilt
  - Python 3.14 was too new — pydantic-core, chromadb, torch had no prebuilt wheels
  - Fresh `.venv` at Python 3.12.10 resolves everything cleanly
- [x] **All backend dependencies installed** from [requirements.txt](backend/requirements.txt)
  - fastapi 0.115.0, uvicorn 0.30.6, pymupdf 1.27.2, chromadb 0.5.5
  - anthropic 0.34.2, openai 1.51.0, sentence-transformers 3.1.1
  - sqlalchemy 2.0.35, pydantic 2.9.2, numpy 1.26.4
  - Smoke test: all 10 packages import successfully
- [x] [.env](.env) file created
- [x] `ANTHROPIC_API_KEY` populated in [.env](.env)
- [ ] `OPENAI_API_KEY` populated in [.env](.env) — **empty; will rely on sentence-transformers fallback**
- [ ] Node.js 20+ confirmed *(frontend scaffold runs via Bun — verify `bun --version`)*
- [ ] Docker Desktop confirmed running (optional — only if using compose)

## ✅ Phase 3 — Backend Scaffolding

- [x] `backend/` folder created with `data/pdfs/` and `data/chroma_db/`
- [x] [backend/requirements.txt](backend/requirements.txt) written and installed
- [x] [backend/config.py](backend/config.py) (paths, model names, tenants, thresholds)
- [x] [backend/main.py](backend/main.py) — FastAPI entry + CORS middleware
- [x] [backend/database.py](backend/database.py) — SQLite via SQLAlchemy (db file: `data/vendor_risk.db`)
- [x] `backend/routers/` — [documents.py](backend/routers/documents.py), [query.py](backend/routers/query.py)
- [x] `backend/services/` — [pdf_extractor.py](backend/services/pdf_extractor.py), [chunker.py](backend/services/chunker.py), [embedder.py](backend/services/embedder.py), [vector_store.py](backend/services/vector_store.py), [llm.py](backend/services/llm.py)
- [ ] `backend/routers/clients.py` — tenant/client management (deferred; hardcoded in config for now)
- [ ] `backend/routers/delta.py` — conflict detection endpoints (Phase 6)

## ✅ Phase 4 — Core RAG Pipeline

- [x] [pdf_extractor.py](backend/services/pdf_extractor.py) — PyMuPDF extraction with bbox metadata
- [x] [chunker.py](backend/services/chunker.py) — page-bounded chunking with union bbox
- [x] [embedder.py](backend/services/embedder.py) — OpenAI embeddings + sentence-transformers fallback
- [x] [vector_store.py](backend/services/vector_store.py) — ChromaDB wrapper (JSON-serialized metadata)
- [x] [llm.py](backend/services/llm.py) — Claude `claude-sonnet-4-6` with IDK enforcement *(untracked in git — needs commit)*
- [x] [routers/documents.py](backend/routers/documents.py) — upload + PDF serving
- [x] [routers/query.py](backend/routers/query.py) — RAG query returning `EvidenceChunk[]`
- [ ] **End-to-end smoke test:** upload a real SOC 2 PDF → query `/api/query` → verify `EvidenceChunk` comes back with non-null `bbox` + `page_width` + `page_height` ← **NEXT**

## 🟡 Phase 5 — Frontend (Substantially Scaffolded)

> **Deviation from PLAN.md:** frontend is **TanStack Start + Vite + Cloudflare**, not Next.js 14 App Router. File-based routing uses flat filenames (`seller.review.$docId.tsx`) instead of nested App Router folders. shadcn/ui + Tailwind are present.

- [x] Frontend scaffolded in `frontend/` (Bun, Vite, TanStack Router, shadcn/ui)
- [x] Routes: `seller.{index,upload,review.$docId,review.index,conflicts,services,settings}.tsx`, `buyer.{tsx,alerts,reports}`, `buyer_.assess.$vendorId.tsx`, `index.tsx`
- [x] Core components in [frontend/src/components/trustlens/](frontend/src/components/trustlens/):
  - `BBoxOverlay.tsx`, `PDFPreview.tsx` — the BBox magic moment primitives
  - `AnswerCard.tsx`, `ConfidenceBar.tsx`, `ConfidenceRing.tsx`, `IDKBadge.tsx`
  - `SellerShell.tsx`, `BuyerShell.tsx`, `Sidebar.tsx`, `StatCard.tsx`
  - `TenantSwitcher.tsx` (Acme / Globex / Initech)
- [x] `frontend/src/lib/` — [api.ts](frontend/src/lib/api.ts), [mockApi.ts](frontend/src/lib/mockApi.ts), [types.ts](frontend/src/lib/types.ts), [utils.ts](frontend/src/lib/utils.ts)
- [ ] Verify `frontend/src/lib/pdfCoords.ts` exists (or coord transform lives elsewhere) — required for the BBox hero moment
- [ ] Wire `api.ts` to the real backend (currently using `mockApi.ts`) once the smoke test passes
- [ ] Framer Motion split-screen slide-open animation verified at 60fps
- [ ] First visual test: click an answer → neon yellow bbox lands on the correct word in a real SOC 2 PDF

## ⬜ Phase 6 — Differentiators (Not Started)

- [ ] Visual BBox Verification — hero demo moment (wired end-to-end with real backend)
- [ ] Delta Engine — `backend/services/delta_engine.py` + `backend/routers/delta.py` + `ConflictQueue.tsx`
- [ ] "Information Not Found" — IDK enforcement visible in UI (dashed border, muted color)

## ⬜ Phase 7 — Demo Polish (Not Started)

- [ ] CAIQ v4 subset curated (~50 questions) into `backend/data/caiq_subset.json`
- [ ] Async pre-compute pipeline populating `cached_answers` table
- [ ] Buyer Trust Vault view reading from cache
- [ ] Conflict queue UI with side-by-side bbox diff
- [ ] End-to-end rehearsal (5+ passes)
- [ ] `scripts/reset_demo.sh` for clean re-runs
- [ ] Fallback recording in case the live demo fails
- [ ] Pitch script finalized

---

**Last updated:** 2026-04-18
**Current focus:** Smoke-test the backend end-to-end (upload SOC 2 PDF → `/api/query` → verify `EvidenceChunk` bbox fields), then wire `frontend/src/lib/api.ts` to the real backend so the BBox hero moment renders against live data instead of `mockApi.ts`.
