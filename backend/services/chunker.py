import hashlib
import uuid
from itertools import groupby

from config import CHUNK_MAX_TOKENS, CHUNK_OVERLAP_SPANS


def _approx_tokens(text: str) -> int:
    # ~4 chars per token is the standard rough estimate for English BPE tokenizers.
    return max(1, len(text) // 4)


def _union_bbox(bboxes: list[list[float]]) -> list[float]:
    x0 = min(b[0] for b in bboxes)
    y0 = min(b[1] for b in bboxes)
    x1 = max(b[2] for b in bboxes)
    y1 = max(b[3] for b in bboxes)
    return [x0, y0, x1, y1]


def _finalize_chunk(
    spans_in_chunk: list[dict],
    document_id: str,
    tenant_id: str,
    doc_version: int,
    chunk_index: int,
) -> dict:
    text = " ".join(s["text"] for s in spans_in_chunk)
    bboxes = [s["bbox"] for s in spans_in_chunk]
    first = spans_in_chunk[0]
    return {
        "chunk_id": str(uuid.uuid4()),
        "document_id": document_id,
        "tenant_id": tenant_id,
        "doc_version": doc_version,
        "chunk_index": chunk_index,
        "text": text,
        "page_number": first["page_number"],
        "bbox": _union_bbox(bboxes),
        "span_bboxes": bboxes,
        "page_width": first["page_width"],
        "page_height": first["page_height"],
        "content_hash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


def chunk_spans(
    spans: list[dict],
    document_id: str,
    tenant_id: str,
    doc_version: int = 1,
    max_tokens: int = CHUNK_MAX_TOKENS,
    overlap_spans: int = CHUNK_OVERLAP_SPANS,
) -> list[dict]:
    """Group spans into page-bounded chunks (chunks NEVER cross page boundaries).

    - Greedy accumulation up to max_tokens (approximate, char/4 heuristic).
    - Overlap: last `overlap_spans` spans of a chunk seed the next chunk on the same page.
    - A single span larger than max_tokens becomes its own chunk.
    """
    chunks: list[dict] = []
    chunk_index = 0

    for page_number, page_spans_iter in groupby(spans, key=lambda s: s["page_number"]):
        page_spans = list(page_spans_iter)
        i = 0
        while i < len(page_spans):
            current: list[dict] = []
            current_tokens = 0
            while i < len(page_spans):
                span = page_spans[i]
                span_tokens = _approx_tokens(span["text"])
                if current and current_tokens + span_tokens > max_tokens:
                    break
                current.append(span)
                current_tokens += span_tokens
                i += 1
            if not current:
                break
            chunks.append(_finalize_chunk(current, document_id, tenant_id, doc_version, chunk_index))
            chunk_index += 1
            # Seed next chunk with overlap, but only if there's more content on this page.
            if i < len(page_spans) and overlap_spans > 0:
                i = max(i - overlap_spans, i - len(current) + 1)

    return chunks
