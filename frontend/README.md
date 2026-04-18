# VerifAI Frontend

Fetched from https://github.com/codeitdijesh/verifai.git and integrated into this repo on 2026-04-18.

## Run locally

```bash
cd frontend
npm install           # ~50s, 514 packages, 0 vulnerabilities
cp .env.example .env  # optional, only needed once backend endpoints exist
npm run dev
```

Dev server: **http://localhost:8080** (port is set by `@lovable.dev/vite-tanstack-config`, not the default Vite 5173).

Verified routes: `/`, `/seller`, `/seller/upload`, `/buyer`, `/buyer/alerts` all return HTTP 200.

Other scripts:
- `npm run build` — production build
- `npm run preview` — serve the production build
- `npm run lint` — ESLint
- `npm run format` — Prettier

Requires Node 18+ (developed and verified on Node 22.14.0, npm 11.2.0).

## Stack

- **Vite 7** + **TanStack Start** + **TanStack Router** (file-based, route tree auto-generated into `src/routeTree.gen.ts`)
- **React 19**, TypeScript
- **Tailwind v4** via `@tailwindcss/vite`, shadcn/ui primitives in `src/components/ui`
- **Framer Motion** for transitions (`motion/react`)
- **Recharts** for charts, **sonner** for toasts, **react-hook-form + zod** for forms
- **Cloudflare Workers** deploy target preconfigured (`wrangler.jsonc`) — not needed for local dev

Tailwind config is embedded in `src/styles.css` (Tailwind v4 style). There is no `tailwind.config.js`.

## What got integrated

Copied everything except `.git` from the upstream repo into `frontend/`:

```
frontend/
├── src/
│   ├── components/
│   │   ├── trustlens/     AnswerCard, BBoxOverlay, BuyerShell, SellerShell,
│   │   │                  ConfidenceBar, ConfidenceRing, IDKBadge,
│   │   │                  PDFPreview, Sidebar, StatCard, TenantSwitcher
│   │   └── ui/            ~45 shadcn/ui primitives
│   ├── context/           TenantContext (localStorage-backed tenant switcher)
│   ├── hooks/             use-mobile
│   ├── lib/
│   │   ├── mockApi.ts     ← self-contained mock layer, currently powers the whole app
│   │   ├── types.ts       EvidenceChunk, QueryAnswer, Conflict, Tenant, BBox, Vendor, TrustDocument, DOMAINS
│   │   └── utils.ts       cn() helper
│   ├── routes/            File-based routes (see below)
│   ├── router.tsx         TanStack router setup + DefaultErrorComponent
│   ├── routeTree.gen.ts   Auto-generated; do not edit by hand
│   └── styles.css         Tailwind v4 directives + theme tokens
├── .env.example           VITE_API_URL placeholder for future backend wiring
├── package.json / package-lock.json / bun.lockb
├── vite.config.ts         Uses @lovable.dev/vite-tanstack-config (see conflict note)
├── wrangler.jsonc         Cloudflare Workers deploy config
└── README.md              (this file)
```

### Routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `routes/index.tsx` | Role picker (Seller / Buyer) |
| `/seller` | `routes/seller.index.tsx` | Seller dashboard |
| `/seller/upload` | `routes/seller.upload.tsx` | PDF upload |
| `/seller/review` | `routes/seller.review.index.tsx` | Review queue |
| `/seller/review/$docId` | `routes/seller.review.$docId.tsx` | Split-screen review w/ bbox |
| `/seller/conflicts` | `routes/seller.conflicts.tsx` | Delta Engine queue |
| `/seller/services` | `routes/seller.services.tsx` | — |
| `/seller/settings` | `routes/seller.settings.tsx` | — |
| `/buyer` | `routes/buyer.tsx` | Trust Vault |
| `/buyer/assess/$vendorId` | `routes/buyer_.assess.$vendorId.tsx` | Vendor assessment |
| `/buyer/alerts` | `routes/buyer.alerts.tsx` | — |
| `/buyer/reports` | `routes/buyer.reports.tsx` | — |

### Data contract

The mock already matches the contract from `PLAN.md` — same `EvidenceChunk`, `QueryAnswer`, `Conflict`, `Tenant` shapes (see `src/lib/types.ts`). When the backend catches up, swapping in a real `api.ts` should be a drop-in.

## Conflicts with `PLAN.md` — things that changed

`PLAN.md` was written assuming a **Next.js 14 App Router** frontend. The fetched frontend is a **Vite + TanStack Start** app instead. The pieces that are affected:

| Area | `PLAN.md` says | Actual frontend | Action |
|------|----------------|-----------------|--------|
| Framework | Next.js 14 App Router | Vite 7 + TanStack Start + TanStack Router | Treat `PLAN.md`'s `src/app/...` paths as conceptual; real paths live in `src/routes/` |
| Dev port | `localhost:3000` | **`localhost:8080`** (Lovable config default) | Backend CORS must allow `http://localhost:8080` (not 3000) |
| Styling | Tailwind + shadcn/ui + Framer Motion | **Same** — no conflict | — |
| Tailwind version | (implied v3, via `shadcn init`) | **Tailwind v4** — config is in `styles.css`, no `tailwind.config.js` | Use `@theme` in CSS, not a JS config file |
| Env var | `NEXT_PUBLIC_API_URL` | **`VITE_API_URL`** (Vite requires the `VITE_` prefix to expose to client) | See `.env.example` |
| Dev command | `npm run dev` (Next.js) | `npm run dev` (Vite) — same command, different server | — |
| Docker frontend command | `npm run dev` on port 3000 | Vite binds 8080 — update `docker-compose.yml` before containerizing | Not urgent; local dev does not use Docker |
| Pages | `src/app/seller/upload/page.tsx` | `src/routes/seller.upload.tsx` (file-based with dots, not folders) | Already built; nothing to port |
| Tenant switcher | localStorage key `activeTenantId` | **Same key, same behavior** — see `src/context/TenantContext.tsx` | — |
| Mock data | "Mock data fallback" (Dev B task) | **Already fully implemented** in `src/lib/mockApi.ts` with 3 tenants × 5 vendors | — |

There are **no code-level conflicts** with the backend (which only has `config.py` and empty folders today) — the frontend runs entirely on `mockApi.ts` until real endpoints exist.

## Finalization steps done

- [x] Copied all source from upstream (excluding `.git`) into `frontend/`
- [x] Installed deps (`npm install`, 514 packages, 0 vulnerabilities)
- [x] Verified dev server starts and serves HTTP 200 on `/`, `/seller`, `/seller/upload`, `/buyer`, `/buyer/alerts`
- [x] Added `frontend/.env.example` with `VITE_API_URL=http://localhost:8000`
- [x] Confirmed `frontend/.gitignore` covers Vite/TanStack artifacts (`node_modules`, `dist`, `.output`, `.vinxi`, `.tanstack`, `.wrangler`, `.dev.vars`)
- [x] Documented the framework conflict vs `PLAN.md` (this file)
- [x] **Backend landed (pull on 2026-04-18)** — patched `backend/main.py` CORS from `http://localhost:3000` only → also allow `http://localhost:8080` and `http://localhost:5173`
- [x] Added `frontend/src/lib/api.ts` — real HTTP client for the endpoints that now exist (type-check passes)

## Backend endpoints currently wired

From `backend/main.py` + `backend/routers/*`:

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | liveness |
| GET | `/api/tenants` | returns `{tenants: [{id, name, industry}]}` from `config.DEMO_TENANTS` — no `vendor_count`/`color`, `api.ts` fills defaults |
| GET | `/api/documents?tenant_id=` | list uploaded docs |
| POST | `/api/documents/upload?tenant_id=&vendor_id=` | multipart PDF upload → extract → chunk → embed → Chroma |
| GET | `/api/documents/{id}/file` | raw PDF binary |
| DELETE | `/api/documents/{id}?tenant_id=` | remove doc + vectors |
| POST | `/api/query` | RAG query → `{answer, confidence, idk, evidence[]}` |

**Not yet exposed:** vendors list, domain scores, CAIQ pre-compute / cached answers, conflicts queue. The frontend's `mockApi.ts` still powers those routes (Trust Vault, Conflicts, per-vendor assessment).

## Using `api.ts` vs `mockApi.ts`

`src/lib/api.ts` is a real HTTP client. `src/lib/mockApi.ts` is the original self-contained demo data. They do **not** have identical surfaces — `api.ts` only covers what the backend actually serves today:

- `health()`
- `getTenants()`
- `getDocuments(tenantId)`
- `uploadDocument(file, tenantId, vendorId?)`
- `documentFileUrl(documentId)`
- `deleteDocument(documentId, tenantId)`
- `queryRag({ question, tenant_id, document_id?, top_k? })`

To flip a single route off the mock, import from `@/lib/api` instead of `@/lib/mockApi` and adjust the shape where needed. Don't do a blanket find/replace — most mock endpoints have no backend counterpart.

## Running the full stack locally

Two terminals.

**Backend** (expects Python 3.11+; PyMuPDF install on Windows can be fragile — see `PLAN.md` Step 0):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows bash; use .venv\Scripts\activate in cmd, or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # fill in ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

Smoke check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.

**Frontend:**

```bash
cd frontend
npm install                     # only first time
# .env is optional; VITE_API_URL defaults to http://localhost:8000
npm run dev
```

Open http://localhost:8080.

## Conflicts between `PLAN.md`, the backend, and the frontend

| Area | `PLAN.md` | Backend (actual) | Frontend (actual) | Resolution |
|------|-----------|------------------|-------------------|------------|
| Frontend framework | Next.js 14 App Router | n/a | Vite 7 + TanStack Start | Frontend is authoritative; update `PLAN.md` when convenient |
| Frontend port | 3000 | CORS was 3000-only (**patched** to include 8080) | 8080 | Fixed in `backend/main.py` |
| Env var | `NEXT_PUBLIC_API_URL` | — | `VITE_API_URL` | `.env.example` reflects Vite convention |
| Embeddings | OpenAI `text-embedding-3-small` (1536-d) with sentence-transformers fallback | sentence-transformers `all-MiniLM-L6-v2` only (384-d); OpenAI branch scaffolded but commented out in `services/embedder.py` — dimensions differ so swapping requires wiping `backend/data/chroma_db/` | n/a | Keep local for now. If switching to OpenAI: uncomment the block, wipe chroma_db, re-embed. |
| Multi-tenancy | `DEMO_TENANTS` with 3 entries (acme / globex / initech) | Same 3 tenants in `config.py` | 3 tenants in `mockApi.ts`, IDs prefixed `t-` (`t-acme`, `t-globex`, `t-initech`) | **Tenant ID mismatch** — backend uses `acme`, mock uses `t-acme`. When swapping a route to `api.ts`, pass the backend-shaped ID. Align later by either dropping the `t-` prefix in the mock or prefixing in the backend. |
| Tenant fields | `{id, name, industry, vendor_count}` | `{id, name, industry}` only | `{id, name, industry, vendor_count, color}` | `api.ts` fills `vendor_count=0` and rotates a color; fine for now |
| `QueryAnswer` shape | `{question, answer, confidence, idk, evidence[]}` | same | adds `question_id`, `domain`, `status` | `api.ts` generates `question_id` via `crypto.randomUUID()`, leaves `domain` blank, defaults `status: "pending_review"` |
| Vendors / conflicts / CAIQ pre-compute | Planned | **Not implemented yet** (no routers, no vendor table, no `cached_answers` writes) | Fully mocked | Frontend stays on mocks for these routes until backend catches up |
| Tailwind | v3 (implied by `shadcn init`) | n/a | v4 (`@theme` in `styles.css`) | No action |
| Doc version tracking | Delta compares `doc_version` | `Document.doc_version` auto-increments per (tenant, vendor) | No UI for versions yet | OK for now |
