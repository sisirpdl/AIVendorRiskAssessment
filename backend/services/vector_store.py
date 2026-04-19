import json
import re
from typing import Optional

import chromadb

from config import CHROMA_DIR

COLLECTION_NAME = "vendor_chunks"

# Heuristics for dropping table-of-contents and index hits at retrieval time.
# TOC lines look like "3.2 Encryption at Rest .......... 15" — long leader runs
# of dots or underscores, trailing page numbers, and low prose density.
_MIN_CHUNK_CHARS = 80
_DOT_LEADER_RE = re.compile(r"[.\u2024\u2025\u2026_]{4,}")
_TRAILING_PAGENUM_RE = re.compile(r"(?:[.\u2026_\s]{2,}|\s)(\d{1,4})\s*$")


def _looks_like_toc(text: str) -> bool:
    """True if the chunk looks like TOC / index noise rather than prose."""
    if len(text) < _MIN_CHUNK_CHARS:
        return True
    if _DOT_LEADER_RE.search(text):
        return True
    # Dense digits + short: probably a page-number index / table caption.
    digit_ratio = sum(ch.isdigit() for ch in text) / max(1, len(text))
    if digit_ratio > 0.2 and len(text) < 200:
        return True
    # Lots of lines that end with a page number (multi-line TOC block).
    trailing_hits = sum(
        1 for line in text.splitlines() if _TRAILING_PAGENUM_RE.search(line.strip())
    )
    if trailing_hits >= 3:
        return True
    return False

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_chunks(chunks: list[dict], embeddings: list[list[float]]) -> None:
    """Upsert chunks + their embeddings into ChromaDB.

    Chunks must carry the fields produced by chunker.chunk_spans(). bbox and
    span_bboxes are JSON-serialized before storage because Chroma metadata must be flat scalars.
    """
    if not chunks:
        return
    ids = [c["chunk_id"] for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [
        {
            "document_id": c["document_id"],
            "tenant_id": c["tenant_id"],
            "doc_version": int(c["doc_version"]),
            "chunk_index": int(c["chunk_index"]),
            "page_number": int(c["page_number"]),
            "page_width": float(c["page_width"]),
            "page_height": float(c["page_height"]),
            "content_hash": c["content_hash"],
            "bbox": json.dumps(c["bbox"]),
            "span_bboxes": json.dumps(c["span_bboxes"]),
        }
        for c in chunks
    ]
    _get_collection().upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def query_chunks(
    query_embedding: list[float],
    tenant_id: str,
    top_k: int,
    document_id: Optional[str] = None,
    document_ids: Optional[list[str]] = None,
) -> list[dict]:
    """Top-k nearest chunks for this tenant. Returns EvidenceChunk-shaped dicts with
    bbox and span_bboxes deserialized back into lists.

    Scope precedence: `document_id` > `document_ids` > tenant-wide.
    """
    where: dict = {"tenant_id": tenant_id}
    if document_id:
        where = {"$and": [{"tenant_id": tenant_id}, {"document_id": document_id}]}
    elif document_ids:
        if len(document_ids) == 1:
            where = {"$and": [{"tenant_id": tenant_id}, {"document_id": document_ids[0]}]}
        elif len(document_ids) > 1:
            where = {
                "$and": [
                    {"tenant_id": tenant_id},
                    {"document_id": {"$in": document_ids}},
                ]
            }

    # Over-fetch so that after dropping TOC/index hits we still have enough
    # real prose chunks to fill top_k. 3x is generous; chroma is cheap.
    overfetch = max(top_k * 3, top_k + 5)
    res = _get_collection().query(
        query_embeddings=[query_embedding],
        n_results=overfetch,
        where=where,
    )

    ids = res["ids"][0]
    docs = res["documents"][0]
    metas = res["metadatas"][0]
    dists = res["distances"][0]

    out: list[dict] = []
    for cid, text, meta, dist in zip(ids, docs, metas, dists):
        if _looks_like_toc(text):
            continue
        out.append({
            "chunk_id": cid,
            "document_id": meta["document_id"],
            "page_number": int(meta["page_number"]),
            "text": text,
            "bbox": json.loads(meta["bbox"]),
            "span_bboxes": json.loads(meta["span_bboxes"]),
            "page_width": float(meta["page_width"]),
            "page_height": float(meta["page_height"]),
            "relevance_score": 1.0 - float(dist),  # cosine distance → similarity
        })
        if len(out) >= top_k:
            break
    return out


def delete_document(document_id: str) -> None:
    _get_collection().delete(where={"document_id": document_id})


def count() -> int:
    return _get_collection().count()
