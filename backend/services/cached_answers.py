import json
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from sqlalchemy import delete, select

from config import BASE_DIR, RAG_TOP_K
from database import CachedAnswer, Document, SessionLocal
from services.embedder import embed_texts
from services.llm import answer_question
from services.vector_store import query_chunks
from services.web_search import answer_via_web

CAIQ_PATH = BASE_DIR / "data" / "caiq_subset.json"

_bank: Optional[list[dict]] = None


def question_bank() -> list[dict]:
    global _bank
    if _bank is None:
        with open(CAIQ_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _bank = data["questions"]
    return _bank


def total_questions() -> int:
    return len(question_bank())


def _humanize(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()


def _evidence_for_api(hits: list[dict]) -> list[dict]:
    return [
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


def _rag_answer(q: dict, document_id: str, tenant_id: str) -> dict:
    q_vec = embed_texts([q["question"]])[0]
    hits = query_chunks(q_vec, tenant_id=tenant_id, top_k=RAG_TOP_K, document_id=document_id)
    result = answer_question(q["question"], hits)
    return {
        "question_id": q["id"],
        "question_text": q["question"],
        "domain": q["domain"],
        "verdict": result["verdict"],
        "answer": result["answer"],
        "confidence": result["confidence"],
        "idk": result["idk"],
        "source": "pdf",
        "evidence_json": json.dumps(_evidence_for_api(hits)),
        "citations_json": json.dumps([]),
    }


def _web_answer(q: dict, vendor_name: str) -> dict:
    result = answer_via_web(q["question"], vendor_name=vendor_name)
    return {
        "verdict": result["verdict"],
        "answer": result["answer"],
        "confidence": result["confidence"],
        "idk": result["idk"],
        "source": "web",
        # Clear any stale PDF evidence from pass 1; web answers are cited via URLs.
        "evidence_json": json.dumps([]),
        "citations_json": json.dumps(result.get("citations", [])),
    }


def _set_status(document_id: str, status: str) -> None:
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
        if doc:
            doc.status = status
            session.commit()


def _upsert_row(document_id: str, tenant_id: str, row: dict, existing_id: Optional[int] = None) -> None:
    with SessionLocal() as session:
        if existing_id:
            ca = session.get(CachedAnswer, existing_id)
            if ca:
                ca.verdict = row["verdict"]
                ca.answer = row["answer"]
                ca.confidence = row["confidence"]
                ca.idk = 1 if row["idk"] else 0
                ca.source = row["source"]
                if "citations_json" in row:
                    ca.citations_json = row["citations_json"]
                if "evidence_json" in row:
                    ca.evidence_json = row["evidence_json"]
                session.commit()
                return
        session.add(CachedAnswer(
            document_id=document_id,
            tenant_id=tenant_id,
            question_id=row["question_id"],
            question_text=row["question_text"],
            domain=row["domain"],
            verdict=row["verdict"],
            answer=row["answer"],
            confidence=row["confidence"],
            idk=1 if row["idk"] else 0,
            source=row["source"],
            evidence_json=row.get("evidence_json", "[]"),
            citations_json=row.get("citations_json", "[]"),
        ))
        session.commit()


def run_precompute(document_id: str, tenant_id: str, max_workers: int = 8) -> None:
    """Two-pass precompute.

    Pass 1: RAG against the uploaded PDF, writes one row per CAIQ question.
    Pass 2: For rows that came back N_A, ask Claude via web_search scoped to
            the vendor name, and update in place (source flips to "web").
    """
    questions = question_bank()

    with SessionLocal() as session:
        session.execute(delete(CachedAnswer).where(CachedAnswer.document_id == document_id))
        session.commit()
        doc = session.get(Document, document_id)
        vendor_name = _humanize(doc.vendor_id) if doc else "the vendor"

    _set_status(document_id, "answering")

    # -- Pass 1: PDF-grounded RAG -------------------------------------------
    def pass1(q: dict) -> None:
        try:
            row = _rag_answer(q, document_id, tenant_id)
        except Exception as e:
            print(f"[precompute pass1] {q['id']} failed: {e}")
            row = {
                "question_id": q["id"],
                "question_text": q["question"],
                "domain": q["domain"],
                "verdict": "N_A",
                "answer": None,
                "confidence": 0.0,
                "idk": True,
                "source": "pdf",
                "evidence_json": json.dumps([]),
                "citations_json": json.dumps([]),
            }
        _upsert_row(document_id, tenant_id, row)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(pass1, questions))

    _set_status(document_id, "web_searching")

    # -- Pass 2: web fallback for every N_A ---------------------------------
    with SessionLocal() as session:
        gaps = session.execute(
            select(CachedAnswer).where(
                CachedAnswer.document_id == document_id,
                CachedAnswer.idk == 1,
            )
        ).scalars().all()
        gap_specs = [
            (ca.id, {"id": ca.question_id, "question": ca.question_text, "domain": ca.domain})
            for ca in gaps
        ]

    def pass2(spec: tuple[int, dict]) -> None:
        cached_id, q = spec
        try:
            row = _web_answer(q, vendor_name=vendor_name)
        except Exception as e:
            print(f"[precompute pass2] {q['id']} failed: {e}")
            return
        # Preserve question metadata fields; merge in the web result.
        merged = {
            "question_id": q["id"],
            "question_text": q["question"],
            "domain": q["domain"],
            **row,
        }
        _upsert_row(document_id, tenant_id, merged, existing_id=cached_id)

    if gap_specs:
        # Web searches are I/O bound; small concurrency is fine but keep polite.
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(pass2, gap_specs))

    _set_status(document_id, "ready")
