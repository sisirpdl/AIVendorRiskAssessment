# Lovable Prompt — VerifAI Frontend

Copy everything between the `---` markers below into Lovable.

---

Build a premium, dark-themed frontend for an AI-native Supply Chain Security platform called **VerifAI**. This is a hackathon MVP — all data is mocked for now; a real FastAPI backend will be wired in later. Prioritize visual polish and smooth animations over depth of features.

## Product Context

VerifAI helps IT Managed Service Providers (MSPs) automate vendor security questionnaires using AI. It has two user modes:

1. **Seller (MSP)** — uploads their client's security documentation (SOC 2 reports, policies) and reviews AI-generated answers before publishing them.
2. **Buyer (Auditor / Client)** — views a "Trust Vault" with verified security posture, confidence scores, and PDF evidence.

Three signature features must be visible in the UI:

- **Visual Bounding Box Verification** — clicking an AI answer slides open a split-screen showing the source PDF with a neon yellow bounding box highlighting the exact proof text.
- **Delta Engine** — when a new version of a document is uploaded, changed answers appear in a "Conflict Resolution" queue with side-by-side diffs.
- **"Information Not Found" Fallback** — answers the AI can't confidently verify are shown with a distinct muted, dashed-border state — never hallucinated.

## Tech Stack (Strict)

- **Next.js 14 App Router** with TypeScript
- **Tailwind CSS** with dark mode as default
- **shadcn/ui** components (New York style, Slate base)
- **Framer Motion** for all animations
- **react-pdf** for PDF rendering
- **lucide-react** for icons
- All data is mocked — create a `src/lib/mockApi.ts` with typed functions that return fake data after a 200–800ms delay (simulate network)

## Design System

**Palette** (Tailwind classes):
- Page background: `bg-slate-950`
- Card/surface: `bg-slate-900`
- Elevated surface: `bg-slate-800`
- Border: `border-slate-800`
- Primary text: `text-slate-100`
- Muted text: `text-slate-400`
- **Signature accent (neon yellow)**: `text-yellow-300`, `border-yellow-400`, `bg-yellow-400/10`
- Verified/success: `text-emerald-400`
- Warning (low confidence): `text-amber-400`
- IDK state: `text-slate-500` with `border-dashed border-slate-700`
- Danger: `text-rose-500`

**Typography**:
- Default font: Inter
- Numbers (confidence %, scores, page numbers): JetBrains Mono or similar monospace
- Headings: medium weight, tight tracking

**Signature visual touches** (do NOT skip these — they define the "premium" feel):
- Subtle radial gradient backgrounds on hero sections: `bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_50%)]`
- A 2px-wide neon yellow vertical bar on the active/selected card's left edge
- Confidence scores animate from 0 to target value on mount (Framer Motion, 600ms ease-out)
- Cards have hover-lift: `transition-transform hover:-translate-y-0.5`
- Glassmorphism on modals: `backdrop-blur-xl bg-slate-900/80`

## Mock Data Shapes (use these exact TypeScript types)

```typescript
export interface BBox { x0: number; y0: number; x1: number; y1: number; }

export interface EvidenceChunk {
  chunk_id: string;
  document_id: string;
  page_number: number;
  text: string;
  bbox: BBox;                    // Union bbox of the whole chunk
  span_bboxes: BBox[];           // Per-word bboxes for fine highlighting
  page_width: number;            // PDF page width in points (e.g., 612)
  page_height: number;           // PDF page height in points (e.g., 792)
  relevance_score: number;       // 0-1
}

export interface QueryAnswer {
  question_id: string;
  question: string;
  domain: string;                // e.g., "Data Security & Encryption"
  answer: string | null;         // null = Information Not Found
  confidence: number;            // 0-1
  idk: boolean;
  evidence: EvidenceChunk[];
  status: "pending_review" | "verified" | "published";
}

export interface Vendor {
  id: string;
  name: string;
  logo_url?: string;
  overall_score: number;         // 0-100
  domain_scores: Record<string, number>;
  document_count: number;
  last_updated: string;          // ISO date
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
}
```

Seed the mock API with:
- 3 tenants: `Acme Corp` (FinTech), `Globex Ltd` (Healthcare), `Initech Inc.` (SaaS)
- 5 vendors per tenant (realistic names: Stripe, Datadog, Cloudflare, Snowflake, Okta, etc.)
- 50 CAIQ-style questions across 8 domains: Access Control & Identity, Data Security & Encryption, Incident Response, Business Continuity, Vulnerability Management, Compliance & Audit, Vendor & Supply Chain, Infrastructure & Ops
- At least 10 answers per vendor with realistic content and varying confidence scores
- 2 answers per vendor in `idk: true` state to showcase the "Information Not Found" UI
- 3 active conflicts for the demo

## Pages & Routing

### `/` — Role Picker (Landing)
- Full-screen dark hero with radial gradient
- Centered VerifAI wordmark with a small neon yellow dot accent
- Two large cards side by side: "I am an MSP (Seller)" and "I am an Auditor (Buyer)"
- Each card has an icon (lucide `Building2` for MSP, `ShieldCheck` for Auditor), a one-line description, and a CTA arrow
- Hover state: card lifts 4px, yellow border glow
- One-liner tagline at top: "Verifiable AI answers for every vendor security question."

### `/seller` — Seller Dashboard Home
- Top nav: VerifAI logo (left), Tenant Switcher dropdown (center-right, see below), user avatar (right, placeholder)
- Four stat cards across the top: Total Documents, Active Vendors, Pending Reviews, Open Conflicts (each with a small sparkline or icon)
- Main panel: grid of Recent Documents (card list with filename, vendor, upload date, processing status chip, "Review" CTA)
- Sidebar nav: Dashboard, Upload, Vendors, Review Queue, Conflicts, Settings

### `/seller/upload` — Upload Page
- Large drag-and-drop zone (dashed yellow border, dark center, drop state animates scale)
- "Upload Trust Package" heading with subtext: "Drop SOC 2 reports, security policies, or compliance documents"
- After drop: shows file list with processing stages (Extracting → Embedding → Running CAIQ Questionnaire → Ready) with a progress bar per file
- Simulate processing with setTimeout staged updates
- Recently uploaded list below the dropzone

### `/seller/review/[docId]` — **THE MAGIC MOMENT — Split-Screen Review**

This is the most important page. Build it carefully.

- Initial state: left panel only (full width) showing a scrollable list of ~15 answer cards for the document
- Each answer card shows:
  - Question text (medium weight)
  - Domain chip (small, muted)
  - Answer text (OR the IDK state if `idk: true`)
  - Horizontal confidence bar (animated fill on mount) with percentage in mono font on the right
  - Status chip: "Pending Review" / "Verified" / "Published"
  - A small "View Evidence →" button
- **Clicking an answer card triggers the magic**:
  - Left panel animates to 50% width (Framer Motion spring, damping: 25)
  - Right panel slides in from the right (`initial={{ x: "100%" }}`, `animate={{ x: 0 }}`)
  - Right panel shows: PDF page image (use a placeholder PDF image — Lovable can't render real PDFs, but design the layout assuming a PDF page is there), with a **neon yellow bounding box overlay** rendered as a CSS absolute-positioned div
  - The bbox should have: 2px yellow border, translucent yellow fill (`bg-yellow-400/20`), a soft yellow glow (`shadow-[0_0_12px_rgba(250,204,21,0.4)]`), and scale-in animation
  - A small pulsing "Verified Proof" badge near the bbox
- Close button in top-right of the right panel collapses it back
- Active answer card gets a neon yellow 2px left border and slight background tint
- At the bottom of the left panel: "Publish All Verified" primary button

### `/seller/conflicts` — Conflict Resolution Queue
- Page header: "Delta Engine" with a chip showing unresolved count
- List of conflict cards, each with:
  - Question at the top
  - Side-by-side two-column layout: "Previous Version" (left, muted) vs "New Version" (right, accent)
  - Each column shows the old/new answer in a styled block with a mini PDF thumbnail preview (placeholder) and bbox highlight
  - Confidence delta displayed as a big arrow with number (e.g., `78% → 45%` with a red down-arrow)
  - Three resolution buttons: "Accept New", "Keep Previous", "Flag for Review"
- Smooth enter/exit animations on resolve (card fades + slides out)

### `/buyer` — Buyer Trust Vault
- Header: "Trust Vault — [Tenant Name]"
- Search bar + domain filter chips
- Grid of vendor cards (3 columns desktop, 1 mobile):
  - Vendor logo placeholder (initials in a colored circle)
  - Vendor name + industry
  - Big overall score (0–100) with circular progress ring (use SVG + stroke-dasharray animation)
  - Domain breakdown: 8 mini bars, one per CAIQ domain, colored by score (green/amber/red)
  - "Last verified" timestamp
  - Click → navigates to `/buyer/assess/[vendorId]`

### `/buyer/assess/[vendorId]` — Vendor Assessment Detail
- Top: vendor identity header with overall score ring + tenant context
- Accordion grouped by CAIQ domain
- Each accordion expands to show question/answer rows
- Each row has the same answer + confidence + IDK treatment as Seller `/review`
- Click "View Evidence" on any row → modal opens with PDF page + bbox (same split-screen treatment but as a modal)
- Export button (PDF icon, non-functional — just a visual)

## Reusable Components (build these)

- `<TenantSwitcher />` — shadcn DropdownMenu in the nav. Shows current tenant with chevron; opens to list of 3 tenants. Selected tenant saves to `localStorage["activeTenantId"]` and triggers a page-level data refresh via a React Context called `TenantContext`. Each tenant has a small colored dot icon.

- `<AnswerCard />` — the answer list item described in `/seller/review`. Accepts a `QueryAnswer`, an `isActive` boolean, and an `onClick` handler.

- `<ConfidenceBar value={0.78} />` — animated horizontal bar with mono-font percentage. Color shifts: ≥0.75 emerald, 0.4–0.75 amber, <0.4 doesn't render because that's IDK.

- `<IDKBadge />` — the "Information Not Found" badge. Slate background, dashed border, info icon, slightly muted. Text: "Information Not Found — Requires Manual Review".

- `<BBoxOverlay bbox={...} pageWidth={...} pageHeight={...} canvasWidth={...} canvasHeight={...} />` — renders an absolutely-positioned yellow highlight over a parent container. Uses this formula:
  ```typescript
  const scaleX = canvasWidth / pageWidth;
  const scaleY = canvasHeight / pageHeight;
  const style = {
    left: bbox.x0 * scaleX,
    top: bbox.y0 * scaleY,
    width: (bbox.x1 - bbox.x0) * scaleX,
    height: (bbox.y1 - bbox.y0) * scaleY,
  };
  ```
  Animate: initial scale 0.92 → 1, opacity 0 → 1, 400ms ease-out. Pulse the shadow twice on mount.

- `<PDFPreview documentId={...} pageNumber={...} highlightBbox={...} />` — for Lovable's mock: just render a styled placeholder "page" (white/off-white rectangle with fake text lines) and overlay the BBoxOverlay on top. Correct proportions: 612x792 (US Letter aspect ratio).

- `<ConfidenceRing value={0.85} size={120} />` — SVG circular progress ring with animated stroke-dasharray.

- `<StatCard title icon value trend />` — top-of-dashboard stat card.

- `<Sidebar />` — vertical nav with lucide icons, active state uses neon yellow left bar.

## Critical Animations (Framer Motion)

1. **Page transitions**: fade + subtle y-translate (400ms, ease-out)
2. **Split-screen open**: right panel `x: 100%` → `x: 0` with spring (`stiffness: 200, damping: 25`), left panel width animates simultaneously
3. **Bbox appear**: `scale: 0.92, opacity: 0` → `scale: 1, opacity: 1` + shadow pulse
4. **Confidence bar fill**: `width: 0%` → `width: target%` on mount, 600ms ease-out
5. **Stat number count-up**: numbers increment from 0 to target over 800ms
6. **Card hover**: `y: 0` → `y: -2px` with 150ms transition
7. **Conflict resolve**: card fades + slides right on click
8. **Confidence ring**: stroke-dasharray animates from full-hidden to target on mount

## Mock API Contract

Create `src/lib/mockApi.ts` with these functions (all async, simulating a 200–800ms delay):

```typescript
getTenants(): Promise<Tenant[]>
getVendors(tenantId: string): Promise<Vendor[]>
getVendor(vendorId: string): Promise<Vendor>
getAnswers(vendorId: string, documentId?: string): Promise<QueryAnswer[]>
getConflicts(tenantId: string): Promise<Conflict[]>
getDocument(documentId: string): Promise<{ id: string; filename: string; vendor_id: string; uploaded_at: string; status: string }>
resolveConflict(conflictId: string, action: "accept_new" | "accept_old" | "flag"): Promise<void>
uploadDocument(file: File): Promise<{ id: string }>  // fakes staged processing
```

Add a `USE_BACKEND` env flag (`NEXT_PUBLIC_USE_BACKEND`) that, when `true`, routes these calls to `http://localhost:8000/api/...` instead of the mock. For now, default to mock.

## Non-Negotiable Details

- Dark mode is the ONLY mode (no toggle)
- Every page must feel like it belongs to the same product — consistent spacing (Tailwind `p-6`, `gap-4` as defaults), consistent card radius (`rounded-xl`), consistent typography scale
- Mobile responsiveness is nice-to-have but desktop-first (judges will see it on a laptop)
- No Material UI. No Chakra. Only shadcn + Tailwind.
- Include a `/components/ui/*` folder with the shadcn primitives
- Zero TypeScript errors at build time

## Success Criteria

If I clone this repo, `npm install && npm run dev`, open `localhost:3000`, click "I am an MSP", upload a file, then click an answer card — I should see a polished split-screen with a neon yellow bounding box that animates in smoothly. That's the magic moment. Optimize for that.

---

**End of prompt.** Paste everything above (between the horizontal rules) into Lovable.
