#!/usr/bin/env bash
# reset_demo.sh — wipe every piece of state the demo touches so you can rehearse
# from a clean slate. Safe to run as many times as needed.
#
# Removes:
#   - backend/data/verifai.db        (SQLite: documents, cached_answers, conflicts, usage_events, share_links)
#   - backend/data/chroma_db/        (ChromaDB persisted embeddings)
#   - backend/data/pdfs/*.pdf        (uploaded PDFs)
#
# Reminds you to clear browser localStorage (TenantContext imports, review edits).
#
# Does NOT touch: backend/data/caiq_subset.json, sample PDFs in so2_reports/

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DATA="$ROOT/backend/data"

echo "[reset] wiping SQLite..."
rm -f "$BACKEND_DATA/verifai.db"

echo "[reset] wiping Chroma DB..."
rm -rf "$BACKEND_DATA/chroma_db"
mkdir -p "$BACKEND_DATA/chroma_db"

echo "[reset] wiping uploaded PDFs..."
rm -f "$BACKEND_DATA/pdfs"/*.pdf 2>/dev/null || true
mkdir -p "$BACKEND_DATA/pdfs"

echo "[reset] done."
echo
echo "Next steps:"
echo "  1. Restart the backend so it recreates the schema."
echo "  2. In your browser devtools, run: localStorage.clear()"
echo "  3. (Optional) Run scripts/preload_demo.sh to upload Matillion + SysAid."
