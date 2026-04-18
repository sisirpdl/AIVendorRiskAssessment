from pathlib import Path
from typing import Union

import fitz  # PyMuPDF

PathLike = Union[str, Path]


def extract_spans(pdf_path: PathLike) -> list[dict]:
    """Flat list of text spans with bbox in PDF points (top-left origin, no Y flip).

    Each span: {text, page_number (1-indexed), bbox: [x0,y0,x1,y1], page_width, page_height}.
    Whitespace-only spans and non-text (image) blocks are skipped.
    """
    doc = fitz.open(str(pdf_path))
    spans: list[dict] = []
    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_width = float(page.rect.width)
            page_height = float(page.rect.height)
            page_dict = page.get_text("dict")
            for block in page_dict.get("blocks", []):
                if block.get("type", 0) != 0:  # 0 = text, 1 = image
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if not text:
                            continue
                        x0, y0, x1, y1 = span["bbox"]
                        spans.append({
                            "text": text,
                            "page_number": page_idx + 1,
                            "bbox": [float(x0), float(y0), float(x1), float(y1)],
                            "page_width": page_width,
                            "page_height": page_height,
                        })
    finally:
        doc.close()
    return spans


def page_count(pdf_path: PathLike) -> int:
    doc = fitz.open(str(pdf_path))
    try:
        return len(doc)
    finally:
        doc.close()
