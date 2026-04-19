#!/usr/bin/env bash
# preload_demo.sh — upload the canonical demo PDFs (Matillion, SysAid) so the
# live demo skips the 30s embed + precompute wait for the buyer flow.
#
# Usage:
#   scripts/preload_demo.sh                            # tenant defaults to "acme"
#   TENANT=globex scripts/preload_demo.sh              # override tenant
#   API=http://localhost:8000 scripts/preload_demo.sh  # override backend URL
#
# Requires the backend to already be running.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${API:-http://localhost:8000}"
TENANT="${TENANT:-acme}"

SAMPLES=(
  "so2_reports/Matillion-SOC-2-Type-2-FINAL-Report.pdf:matillion"
  "so2_reports/SysAid_SOC2TypeII_FinalReport2024.pdf:sysaid"
)

echo "[preload] checking backend at $API..."
if ! curl -fsS "$API/api/health" > /dev/null 2>&1; then
  echo "[preload] ERROR: backend not responding at $API/api/health"
  echo "[preload] start it with: cd backend && uvicorn main:app --reload"
  exit 1
fi

for entry in "${SAMPLES[@]}"; do
  path="${entry%%:*}"
  vendor="${entry##*:}"
  full="$ROOT/$path"

  if [[ ! -f "$full" ]]; then
    echo "[preload] skipping $path — file not found"
    continue
  fi

  echo "[preload] uploading $(basename "$path") as vendor=$vendor tenant=$TENANT ..."
  curl -fsS -X POST \
    "$API/api/documents/upload?tenant_id=$TENANT&vendor_id=$vendor" \
    -F "file=@$full" \
    | python -c "import sys,json; d=json.load(sys.stdin); print(f'  -> document_id={d[\"document_id\"]} chunks={d[\"chunk_count\"]} pages={d[\"page_count\"]}')" \
    || echo "[preload] upload failed for $path"
done

echo
echo "[preload] Precompute is running in the background. Poll status via:"
echo "  curl $API/api/documents?tenant_id=$TENANT"
echo
echo "[preload] Takes ~30-60s per document (50 questions x RAG + any web fallbacks)."
