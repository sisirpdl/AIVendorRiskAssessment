import json

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from database import CachedAnswer, Document, SessionLocal
from services.cached_answers import total_questions

router = APIRouter()


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
                "answer": r.answer,
                "confidence": float(r.confidence),
                "idk": bool(r.idk),
                "evidence": json.loads(r.evidence_json or "[]"),
                "status": "pending_review",
            }
            for r in rows
        ]

        return {
            "status": doc.status,  # "answering" | "ready" | "failed" | "processing"
            "total": total_questions(),
            "answers": answers,
        }
