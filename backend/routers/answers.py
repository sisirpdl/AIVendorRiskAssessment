import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from database import CachedAnswer, Document, SessionLocal
from services.cached_answers import total_questions

router = APIRouter()


class AnswerPatch(BaseModel):
    verdict: Literal["YES", "NO", "N_A"]
    answer: str = Field(default="")


@router.get("/answers")
def get_cached_answers(document_id: str = Query(...), tenant_id: str = Query(...)) -> dict:
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
        if not doc or doc.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Document not found")

        rows = session.execute(
            select(CachedAnswer)
            .where(CachedAnswer.document_id == document_id)
            .order_by(CachedAnswer.question_id)
        ).scalars().all()

        answers = [
            {
                "question_id": r.question_id,
                "question": r.question_text,
                "domain": r.domain,
                "verdict": r.verdict,
                "answer": r.answer,
                "confidence": float(r.confidence),
                "idk": bool(r.idk),
                "source": r.source,
                "evidence": json.loads(r.evidence_json or "[]"),
                "citations": json.loads(r.citations_json or "[]"),
                "status": "pending_review",
            }
            for r in rows
        ]

        return {
            "status": doc.status,  # "answering" | "ready" | "failed" | "processing"
            "total": total_questions(),
            "answers": answers,
        }


@router.patch("/answers/{document_id}/{question_id}")
def patch_answer(
    document_id: str,
    question_id: str,
    patch: AnswerPatch,
    tenant_id: str = Query(...),
) -> dict:
    """Persist a human-verified override for one CAIQ question.

    Replaces verdict + answer on the existing cached_answers row (keeps the
    original question_text + domain). Clears evidence and citations because
    the source of truth is now a manual entry, not AI retrieval."""
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
        if not doc or doc.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Document not found")

        row = session.execute(
            select(CachedAnswer).where(
                CachedAnswer.document_id == document_id,
                CachedAnswer.question_id == question_id,
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Answer not found")

        is_na = patch.verdict == "N_A"
        row.verdict = patch.verdict
        row.answer = None if is_na else patch.answer
        row.confidence = 0.0 if is_na else 1.0
        row.idk = 1 if is_na else 0
        row.source = "manual"
        row.evidence_json = "[]"
        row.citations_json = "[]"
        session.commit()

        return {
            "question_id": row.question_id,
            "question": row.question_text,
            "domain": row.domain,
            "verdict": row.verdict,
            "answer": row.answer,
            "confidence": float(row.confidence),
            "idk": bool(row.idk),
            "source": row.source,
            "evidence": [],
            "citations": [],
            "status": "verified",
        }
