"""
Upload all Cloudflare corpus PDFs to the running VerifAI backend.

Requires:
    - backend running at http://localhost:8000  (python -m uvicorn main:app --reload)
    - corpus already fetched:  python scripts/fetch_cloudflare_corpus.py

Usage:
    python scripts/seed_cloudflare.py [--tenant acme] [--api http://localhost:8000]

Each PDF is uploaded as vendor_id="cloudflare" under the given tenant.
"""

import argparse
import sys
import time
from pathlib import Path

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CORPUS_DIR = Path(__file__).parent / "corpus" / "cloudflare"

# Upload order matters for the demo: compliance docs first, then whitepapers
UPLOAD_ORDER = [
    "cloudflare-soc3-report.pdf",
    "cloudflare-iso-privacy-compliance.pdf",
    "cloudflare-gdpr-europe-data-protection.pdf",
    "cloudflare-pci-dss-compliance.pdf",
    "cloudflare-data-privacy-law-enforcement.pdf",
    "cloudflare-network-resilience.pdf",
    "cloudflare-zero-trust-roadmap.pdf",
    "cloudflare-transparency-report-1h-2023.pdf",
    "cloudflare-security-txt.pdf",
    "cloudflare-csa-star-caiq.pdf",   # optional; skipped if not present
]


def check_backend(client: httpx.Client, api: str) -> bool:
    try:
        r = client.get(f"{api}/api/health", timeout=5)
        r.raise_for_status()
        return True
    except Exception as e:
        print(f"\n  ✗ Backend not reachable at {api}: {e}")
        print("  Make sure you ran:  uvicorn main:app --reload  (from backend/)")
        return False


def already_ingested(client: httpx.Client, api: str, tenant_id: str, vendor_id: str) -> set[str]:
    """Return set of filenames already in the database for this tenant/vendor."""
    try:
        r = client.get(f"{api}/api/documents", params={"tenant_id": tenant_id}, timeout=10)
        r.raise_for_status()
        docs = r.json().get("documents", [])
        return {
            d["filename"]
            for d in docs
            if d.get("vendor_id") == vendor_id and d.get("status") == "ready"
        }
    except Exception:
        return set()


def upload(client: httpx.Client, api: str, tenant_id: str, vendor_id: str, pdf_path: Path) -> dict:
    with pdf_path.open("rb") as fh:
        r = client.post(
            f"{api}/api/documents/upload",
            params={"tenant_id": tenant_id, "vendor_id": vendor_id},
            files={"file": (pdf_path.name, fh, "application/pdf")},
            timeout=300,  # large PDFs can take a while to embed
        )
    r.raise_for_status()
    return r.json()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Cloudflare corpus into VerifAI")
    parser.add_argument("--tenant", default="acme", help="Tenant ID (default: acme)")
    parser.add_argument("--api", default="http://localhost:8000", help="Backend base URL")
    args = parser.parse_args()

    if not CORPUS_DIR.exists():
        print(f"✗ Corpus directory not found: {CORPUS_DIR}")
        print("  Run first:  python scripts/fetch_cloudflare_corpus.py")
        sys.exit(1)

    with httpx.Client() as client:
        print(f"\nVerifAI Cloudflare Corpus Seeder")
        print(f"  tenant : {args.tenant}")
        print(f"  vendor : cloudflare")
        print(f"  api    : {args.api}")
        print("─" * 50)

        if not check_backend(client, args.api):
            sys.exit(1)

        ingested = already_ingested(client, args.api, args.tenant, "cloudflare")
        if ingested:
            print(f"  Already ingested ({len(ingested)} docs): {', '.join(sorted(ingested))}")

        uploaded = 0
        skipped = 0
        failed = 0

        for filename in UPLOAD_ORDER:
            pdf_path = CORPUS_DIR / filename
            if not pdf_path.exists():
                continue  # optional file not downloaded

            if filename in ingested:
                print(f"  ✓ skip  {filename} (already in DB)")
                skipped += 1
                continue

            size_kb = pdf_path.stat().st_size // 1024
            print(f"  ↑ upload {filename} ({size_kb} KB) ...", end="", flush=True)
            try:
                result = upload(client, args.api, args.tenant, "cloudflare", pdf_path)
                chunks = result.get("chunk_count", "?")
                pages = result.get("page_count", "?")
                print(f" ✓  {pages} pages, {chunks} chunks")
                uploaded += 1
            except httpx.HTTPStatusError as e:
                print(f" ✗ HTTP {e.response.status_code}: {e.response.text[:120]}")
                failed += 1
            except Exception as e:
                print(f" ✗ {e}")
                failed += 1

            time.sleep(0.5)  # breathe between uploads

        print("\n" + "─" * 50)
        print(f"  Uploaded : {uploaded}")
        print(f"  Skipped  : {skipped}")
        if failed:
            print(f"  Failed   : {failed}")
        print()
        print("  Demo questions to try against the Cloudflare corpus:")
        demo_qs = [
            "Is Cloudflare SOC 2 Type II certified?",
            "What ISO certifications does Cloudflare hold?",
            "How does Cloudflare handle law enforcement data requests?",
            "Is Cloudflare PCI DSS 4.0 compliant?",
            "How does Cloudflare comply with GDPR?",
            "What is Cloudflare's network resilience and uptime guarantee?",
            "Does Cloudflare support Zero Trust architecture?",
            "How many government requests did Cloudflare receive?",
            "What is Cloudflare's vulnerability disclosure policy and bug bounty?",
        ]
        for q in demo_qs:
            print(f"    • {q}")
        print()


if __name__ == "__main__":
    main()
