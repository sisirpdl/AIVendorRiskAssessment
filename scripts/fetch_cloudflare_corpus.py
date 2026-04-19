"""
Download all public Cloudflare security documents into scripts/corpus/cloudflare/.

Sources:
  - Cloudflare Trust Hub (cloudflare.com/trust-hub)
  - cf-assets.www.cloudflare.com (direct PDF CDN)
  - cloudflare.com/.well-known/security.txt → converted to PDF via PyMuPDF

Usage (from project root, backend venv active):
    python scripts/fetch_cloudflare_corpus.py
"""

import sys
import time
from pathlib import Path

import fitz  # PyMuPDF - already in backend requirements
import httpx
import io, os
# Force UTF-8 output on Windows so Unicode symbols don't crash
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CORPUS_DIR = Path(__file__).parent / "corpus" / "cloudflare"
CORPUS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Public PDF documents confirmed from Cloudflare's CDN / trust hub
# ---------------------------------------------------------------------------
PDF_DOCS = [
    {
        "filename": "cloudflare-soc3-report.pdf",
        "url": "https://www.cloudflare.com/resources/assets/slt3lc6tev37/68oHQbiMBGK65EKiyHgWvh/6685231d288258b0618410632063e1eb/Cloudflare-SOC3-Report.pdf",
        "label": "SOC 3 Report",
    },
    {
        "filename": "cloudflare-iso-privacy-compliance.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/2XCNxD0AemDQvMNgWvoo37/39a0d3b7ac963b2854f93673855e55f9/BDES-1265_Privacy_Compliance_Whitepapers_ISO.pdf",
        "label": "ISO / Privacy Compliance Whitepaper",
    },
    {
        "filename": "cloudflare-data-privacy-law-enforcement.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/2RM2ZAb5XJiudjz4QHvth4/2084fe4b142af68b9b5b755f914cf5aa/BDES-5987%5FWHITEPAPER-Cloudflare-policies-data-privacy-law-enforcement-AQ1-RM.pdf",
        "label": "Data Privacy & Law Enforcement Whitepaper",
    },
    {
        "filename": "cloudflare-network-resilience.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/7ad0dpR3YyqxMlikPfbBgn/020b7450909f03ccf3c7dcfb0e99fc2e/Resilience_Whitepaper.pdf",
        "label": "Network & Service Resilience Whitepaper",
    },
    {
        "filename": "cloudflare-zero-trust-roadmap.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/9jyDLdW3VXPGwChDCCnrx/a4b7f7825e229f2caeaa1a12a2d16b24/Whitepaper_A-Roadmap-to-Zero-Trust-Architecture.pdf",
        "label": "Zero Trust Architecture Whitepaper",
    },
    {
        "filename": "cloudflare-pci-dss-compliance.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/jOnrP7f3eRyCbRTzX15mX/c97edef0697a204343136612b820c3ae/BDES-5776_PCI-Compliance-Whitepaper_Letter.pdf",
        "label": "PCI DSS 4.0 Compliance Whitepaper",
    },
    {
        "filename": "cloudflare-gdpr-europe-data-protection.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/66yV5siqmSYsx6u1POPxb7/84757b4c8a9941ac80fa4efae9a0cf79/cloudflare-helps-obligations-europe-whitepaper.pdf",
        "label": "GDPR / Europe Data Protection Whitepaper",
    },
    {
        "filename": "cloudflare-transparency-report-1h-2023.pdf",
        "url": "https://cf-assets.www.cloudflare.com/slt3lc6tev37/21IVu01e1dDHYxcEOlFdBQ/2c5be22bbeac99978ec3c4918ba5d5ee/Transparency_report_-_1H_2023.pdf",
        "label": "Transparency Report 1H 2023",
    },
]

# ---------------------------------------------------------------------------
# CSA STAR CAIQ — may be Excel; try it, skip gracefully if wrong mime type
# ---------------------------------------------------------------------------
CAIQ_URL = "https://cloudsecurityalliance.org/star/registry/cloudflare-inc/services/cloudflare-inc/download/fg2wEA"

# ---------------------------------------------------------------------------
# security.txt content (fetched live; also hardcoded as fallback)
# ---------------------------------------------------------------------------
SECURITY_TXT_URL = "https://www.cloudflare.com/.well-known/security.txt"
SECURITY_TXT_FALLBACK = """\
Contact: https://hackerone.com/cloudflare
# All abuse reports should be submitted to our Trust & Safety team
# through our dedicated page.
Contact: https://www.cloudflare.com/abuse/
Policy: https://www.cloudflare.com/disclosure/
Hiring: https://www.cloudflare.com/careers/jobs/
Preferred-Languages: en
Canonical: https://www.cloudflare.com/.well-known/security.txt
"""


def _bar(label: str, idx: int, total: int) -> str:
    pct = int((idx / total) * 20)
    return f"[{'█' * pct}{'░' * (20 - pct)}] {idx}/{total}  {label}"


def download_pdf(client: httpx.Client, url: str, dest: Path, label: str) -> bool:
    if dest.exists():
        print(f"  ✓ skip  {label} (already downloaded)")
        return True
    try:
        print(f"  ↓ fetch {label} ...", end="", flush=True)
        r = client.get(url, follow_redirects=True, timeout=60)
        r.raise_for_status()
        ct = r.headers.get("content-type", "")
        if "pdf" not in ct.lower() and not url.lower().endswith(".pdf"):
            print(f" ✗ unexpected content-type: {ct}")
            return False
        dest.write_bytes(r.content)
        kb = len(r.content) // 1024
        print(f" ✓ {kb} KB")
        return True
    except Exception as e:
        print(f" ✗ {e}")
        return False


def text_to_pdf(text: str, dest: Path, title: str) -> None:
    """Convert plain text to a single-column PDF using PyMuPDF."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4
    # Title block
    page.insert_text(
        (50, 60),
        title,
        fontsize=14,
        fontname="helv",
        color=(0, 0, 0),
    )
    page.draw_line((50, 72), (545, 72), color=(0.8, 0.8, 0.8), width=0.5)
    # Body text — wrap at ~90 chars / line
    y = 90
    for line in text.splitlines():
        page.insert_text((50, y), line or " ", fontsize=10, fontname="cour", color=(0.1, 0.1, 0.1))
        y += 14
        if y > 800:
            page = doc.new_page(width=595, height=842)
            y = 60
    doc.save(str(dest))
    doc.close()


def fetch_security_txt(client: httpx.Client) -> str:
    try:
        r = client.get(SECURITY_TXT_URL, timeout=15, follow_redirects=True)
        r.raise_for_status()
        return r.text
    except Exception:
        return SECURITY_TXT_FALLBACK


def fetch_caiq(client: httpx.Client, dest_dir: Path) -> bool:
    """Attempt to download CSA STAR CAIQ — it may be an Excel file."""
    dest_xlsx = dest_dir / "cloudflare-csa-star-caiq.xlsx"
    dest_pdf = dest_dir / "cloudflare-csa-star-caiq.pdf"
    if dest_pdf.exists():
        print("  ✓ skip  CSA STAR CAIQ (already converted to PDF)")
        return True
    if dest_xlsx.exists():
        print("  ~ found CAIQ XLSX, converting to PDF ...", end="", flush=True)
        _caiq_xlsx_to_pdf(dest_xlsx, dest_pdf)
        return True
    try:
        print("  ↓ fetch CSA STAR CAIQ ...", end="", flush=True)
        r = client.get(CAIQ_URL, follow_redirects=True, timeout=30)
        r.raise_for_status()
        ct = r.headers.get("content-type", "")
        if "pdf" in ct.lower():
            dest_pdf.write_bytes(r.content)
            print(f" ✓ PDF  {len(r.content) // 1024} KB")
        elif "excel" in ct.lower() or "spreadsheet" in ct.lower() or "xlsx" in ct.lower():
            dest_xlsx.write_bytes(r.content)
            print(f" ✓ XLSX {len(r.content) // 1024} KB")
            # Convert XLSX to PDF so the backend can ingest it
            _caiq_xlsx_to_pdf(dest_xlsx, dest_pdf)
        else:
            print(f" ✗ unexpected content-type: {ct} — skipping")
            return False
        return True
    except Exception as e:
        print(f" ✗ {e} — skipping")
        return False


def _caiq_xlsx_to_pdf(xlsx_path: Path, pdf_path: Path) -> None:
    """Convert CSA STAR CAIQ Excel to a searchable PDF using openpyxl + PyMuPDF.

    Sheet layout (CAIQv4.0.3):
      Col 0: Question ID   Col 1: Question   Col 2: Answer
      Col 3: Ownership     Col 4: Implementation Description
    """
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError:
        print("\n  ! openpyxl not installed — CAIQ PDF conversion skipped. pip install openpyxl")
        return

    try:
        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
        ws = wb["CAIQv4.0.3"]
        rows = list(ws.iter_rows(values_only=True))

        doc = fitz.open()
        PAGE_W, PAGE_H = 842, 595  # A4 landscape
        MARGIN = 40
        TEXT_W = PAGE_W - 2 * MARGIN

        def new_page(doc):
            p = doc.new_page(width=PAGE_W, height=PAGE_H)
            p.draw_rect(fitz.Rect(0, 0, PAGE_W, 26), color=None, fill=(0.04, 0.04, 0.04))
            p.insert_text(
                (MARGIN, 17),
                "Cloudflare — CSA STAR CAIQ v4.0.3 Self-Assessment (cloudsecurityalliance.org)",
                fontsize=9, fontname="helv", color=(1, 1, 1),
            )
            return p, 38

        page, y = new_page(doc)

        def _cell(row, idx):
            return str(row[idx]).strip() if row and idx < len(row) and row[idx] is not None else ""

        for row in rows[1:]:  # skip title row at index 0
            if not row or not row[0]:
                continue
            qid = _cell(row, 0)
            question = _cell(row, 1)
            answer = _cell(row, 2)
            impl = _cell(row, 4)

            if not qid or qid == "Question ID":
                continue

            # Determine answer color: Yes=green, No=red, else gray
            ans_color = (0.0, 0.6, 0.2) if answer == "Yes" else (
                (0.8, 0.1, 0.1) if answer == "No" else (0.5, 0.5, 0.5)
            )

            # Estimate height needed for this entry
            q_lines = max(1, len(question) // 110 + 1)
            i_lines = max(1, len(impl) // 110 + 1) if impl else 0
            entry_h = 14 + (q_lines * 11) + (i_lines * 10) + 6

            if y + entry_h > PAGE_H - 20:
                page, y = new_page(doc)

            # Question ID + Answer badge
            page.insert_text((MARGIN, y + 10), qid, fontsize=9, fontname="helv", color=(0.9, 0.7, 0.0))
            page.insert_text((MARGIN + 80, y + 10), f"[{answer}]", fontsize=9, fontname="helv", color=ans_color)
            y += 14

            # Question text
            page.insert_textbox(
                fitz.Rect(MARGIN, y, MARGIN + TEXT_W, y + q_lines * 11 + 2),
                question, fontsize=10, fontname="helv", color=(0.1, 0.1, 0.1),
            )
            y += q_lines * 11 + 3

            # Implementation description (indented, smaller)
            if impl:
                page.insert_textbox(
                    fitz.Rect(MARGIN + 10, y, MARGIN + TEXT_W, y + i_lines * 10 + 2),
                    impl, fontsize=8.5, fontname="helv", color=(0.3, 0.3, 0.3),
                )
                y += i_lines * 10 + 4

            # Thin separator line
            page.draw_line((MARGIN, y), (MARGIN + TEXT_W, y), color=(0.85, 0.85, 0.85), width=0.3)
            y += 4

        page_count = len(doc)
        doc.save(str(pdf_path))
        doc.close()
        wb.close()
        print(f"  ✓ converted CAIQ to PDF ({pdf_path.stat().st_size // 1024} KB, {page_count} pages)")
    except Exception as e:
        print(f"\n  ! CAIQ PDF conversion failed: {e}")


def main() -> None:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; VerifAI-demo-fetcher/1.0; "
            "+https://github.com/codeitdijesh)"
        )
    }
    ok = 0
    fail = 0

    with httpx.Client(headers=headers) as client:
        # --- PDFs -----------------------------------------------------------
        total = len(PDF_DOCS)
        for i, doc in enumerate(PDF_DOCS, 1):
            dest = CORPUS_DIR / doc["filename"]
            success = download_pdf(client, doc["url"], dest, doc["label"])
            if success:
                ok += 1
            else:
                fail += 1
            time.sleep(0.3)  # polite crawl delay

        # --- security.txt → PDF --------------------------------------------
        sec_dest = CORPUS_DIR / "cloudflare-security-txt.pdf"
        if sec_dest.exists():
            print("  ✓ skip  security.txt (already generated)")
        else:
            print("  ↓ fetch security.txt ...", end="", flush=True)
            txt = fetch_security_txt(client)
            # Enrich with HackerOne bug bounty metadata
            full_text = (
                "Cloudflare Security Disclosure & Bug Bounty Program\n"
                "Source: cloudflare.com/.well-known/security.txt\n"
                "Retrieved: 2024\n\n"
                + txt
                + "\n\n--- Bug Bounty Program ---\n"
                "Platform: HackerOne\n"
                "URL: https://hackerone.com/cloudflare\n"
                "Scope: cloudflare.com, *.cloudflare.com, Workers, Pages, R2, Stream, etc.\n"
                "Rewards: $200 – $3,000+ (critical)\n"
                "Status: Active, public programme\n"
            )
            text_to_pdf(full_text, sec_dest, "Cloudflare — Vulnerability Disclosure & Bug Bounty")
            print(f" ✓ generated ({sec_dest.stat().st_size // 1024} KB)")
            ok += 1

        # --- CSA STAR CAIQ --------------------------------------------------
        fetch_caiq(client, CORPUS_DIR)

    # --- Summary -----------------------------------------------------------
    print("\n" + "─" * 50)
    print(f"  Corpus saved to:  {CORPUS_DIR.resolve()}")
    print(f"  PDFs ready:       {ok}")
    if fail:
        print(f"  Failed:           {fail}")
    files = sorted(CORPUS_DIR.glob("*.pdf"))
    print(f"\n  Files ({len(files)}):")
    for f in files:
        print(f"    {f.name:55s}  {f.stat().st_size // 1024:>5} KB")
    print()
    print("  Next step: python scripts/seed_cloudflare.py")


if __name__ == "__main__":
    main()
