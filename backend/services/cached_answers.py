import json
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from sqlalchemy import delete, select

from config import BASE_DIR, RAG_TOP_K
from database import CachedAnswer, Document, SessionLocal
from services.delta import detect_and_persist_conflicts, snapshot_answers
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


def _rag_answer(q: dict, document_ids: list[str], tenant_id: str) -> dict:
    # Embed `question + guidance` for retrieval so keyword hints pull in topically
    # relevant chunks even when the question's phrasing doesn't match the doc.
    # Retrieval spans every document uploaded for this vendor — so a SOC 2 + a
    # pentest + a DPA can all contribute evidence to a single answer.
    guidance = q.get("guidance")
    embed_text = f"{q['question']} {guidance}" if guidance else q["question"]
    q_vec = embed_texts([embed_text])[0]
    hits = query_chunks(
        q_vec,
        tenant_id=tenant_id,
        top_k=RAG_TOP_K,
        document_ids=document_ids,
    )
    result = answer_question(q["question"], hits, guidance=guidance)
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
    result = answer_via_web(q["question"], vendor_name=vendor_name, guidance=q.get("guidance"))
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
    """Two-pass precompute for a vendor.

    Pass 1: RAG across EVERY document uploaded for this vendor (not just the
            freshly-uploaded one). Adding a pentest report to a vendor who
            already has a SOC 2 will re-answer all 50 questions against the
            pooled evidence.
    Pass 2: For rows that came back N_A, ask Claude via web_search scoped to
            the vendor name, and update in place (source flips to "web").

    Result: ONE set of 50 cached_answers rows per vendor, stored under the
    newest document_id. Evidence chunks carry their own document_id so the
    UI serves whichever PDF the span actually came from.
    """
    questions = question_bank()

    # Resolve vendor + pool of docs before we kick off the passes.
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
        if not doc:
            print(f"[precompute] doc {document_id} not found, aborting")
            return
        vendor_id = doc.vendor_id
        vendor_name = _humanize(vendor_id)
        vendor_doc_ids = session.execute(
            select(Document.id).where(
                Document.tenant_id == tenant_id,
                Document.vendor_id == vendor_id,
            )
        ).scalars().all()

    # Delta Engine pre-snapshot: capture the previous answer set BEFORE pass 1
    # wipes it. If this is the vendor's first upload there is nothing to diff
    # against and we just skip delta detection at the end.
    prior_doc_ids = [d for d in vendor_doc_ids if d != document_id]
    old_snapshot = snapshot_answers(prior_doc_ids) if prior_doc_ids else {}

    with SessionLocal() as session:
        # Blow away any prior answers for this vendor so we end up with exactly
        # one set of 50 rows (keyed by the latest uploaded doc).
        session.execute(
            delete(CachedAnswer).where(CachedAnswer.document_id.in_(vendor_doc_ids))
        )
        session.commit()

    _set_status(document_id, "answering")

    # -- Pass 1: PDF-grounded RAG, pooled across all vendor documents --------
    def pass1(q: dict) -> None:
        try:
            row = _rag_answer(q, vendor_doc_ids, tenant_id)
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

    # -- Phase 2: Delta Engine. Only runs if there was a prior upload. ------
    if old_snapshot:
        try:
            written = detect_and_persist_conflicts(
                tenant_id=tenant_id,
                vendor_id=vendor_id,
                new_document_id=document_id,
                old_snapshot=old_snapshot,
            )
            print(f"[precompute] delta engine wrote {written} conflicts for {vendor_id}")
        except Exception as e:
            print(f"[precompute] delta engine failed: {e}")

    _set_status(document_id, "ready")
