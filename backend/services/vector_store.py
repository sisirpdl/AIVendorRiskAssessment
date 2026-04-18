import json
from typing import Optional

import chromadb

from config import CHROMA_DIR

COLLECTION_NAME = "vendor_chunks"

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
) -> list[dict]:
    """Top-k nearest chunks for this tenant. Returns EvidenceChunk-shaped dicts with
    bbox and span_bboxes deserialized back into lists.
    """
    where: dict = {"tenant_id": tenant_id}
    if document_id:
        where = {"$and": [{"tenant_id": tenant_id}, {"document_id": document_id}]}

    res = _get_collection().query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,
    )

    ids = res["ids"][0]
    docs = res["documents"][0]
    metas = res["metadatas"][0]
    dists = res["distances"][0]

    out: list[dict] = []
    for cid, text, meta, dist in zip(ids, docs, metas, dists):
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
    return out


def delete_document(document_id: str) -> None:
    _get_collection().delete(where={"document_id": document_id})


def count() -> int:
    return _get_collection().count()
