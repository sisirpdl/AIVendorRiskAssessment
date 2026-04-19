import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from sqlalchemy import delete

from config import BASE_DIR, RAG_TOP_K
from database import CachedAnswer, Document, SessionLocal
from services.embedder import embed_texts
from services.llm import answer_question
from services.vector_store import query_chunks

CAIQ_PATH = BASE_DIR / "data" / "caiq_subset.json"

_bank: Optional[list[dict]] = None


def question_bank() -> list[dict]:
    global _bank
    if _bank is None:
        with open(CAIQ_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _bank = data["questions"]
    return _bank


def _answer_one(q: dict, document_id: str, tenant_id: str) -> dict:
    q_vec = embed_texts([q["question"]])[0]
    hits = query_chunks(q_vec, tenant_id=tenant_id, top_k=RAG_TOP_K, document_id=document_id)
    result = answer_question(q["question"], hits)
    evidence = [
        {
            "chunk_id": h["chunk_id"],
            "document_id": h["document_id"],
            "page_number": h["page_number"],
            "text": h["text"],
            "bbox": {"x0": h["bbox"][0], "y0": h["bbox"][1], "x1": h["bbox"][2], "y1": h["bbox"][3]},
            "span_bboxes": [
                {"x0": b[0], "y0": b[1], "x1": b[2], "y1": b[3]} for b in h["span_bboxes"]
            ],
            "page_width": h["page_width"],
            "page_height": h["page_height"],
            "relevance_score": h["relevance_score"],
        }
        for h in hits
    ]
    return {
        "question_id": q["id"],
        "question_text": q["question"],
        "domain": q["domain"],
        "answer": result["answer"],
        "confidence": result["confidence"],
        "idk": result["idk"],
        "evidence_json": json.dumps(evidence),
    }


def _set_status(document_id: str, status: str) -> None:
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
        if doc:
            doc.status = status
            session.commit()


def run_precompute(document_id: str, tenant_id: str, max_workers: int = 8) -> None:
    """Run the full CAIQ subset against a document and populate cached_answers.

    Idempotent: deletes any existing cached_answers rows for this doc first.
    Writes each answer as soon as it resolves so the UI can poll progressively.
    Flips Document.status: ready -> answering -> ready.
    """
    questions = question_bank()

    with SessionLocal() as session:
        session.execute(delete(CachedAnswer).where(CachedAnswer.document_id == document_id))
        session.commit()

    _set_status(document_id, "answering")

    def work(q: dict) -> None:
        try:
            row = _answer_one(q, document_id, tenant_id)
        except Exception as e:
            row = {
                "question_id": q["id"],
                "question_text": q["question"],
                "domain": q["domain"],
                "answer": None,
                "confidence": 0.0,
                "idk": True,
                "evidence_json": json.dumps([]),
            }
            print(f"[precompute] {q['id']} failed: {e}")
        with SessionLocal() as session:
            session.add(CachedAnswer(
                document_id=document_id,
                tenant_id=tenant_id,
                question_id=row["question_id"],
                question_text=row["question_text"],
                domain=row["domain"],
                answer=row["answer"],
                confidence=row["confidence"],
                idk=1 if row["idk"] else 0,
                evidence_json=row["evidence_json"],
            ))
            session.commit()

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(work, questions))

    _set_status(document_id, "ready")


def total_questions() -> int:
    return len(question_bank())
