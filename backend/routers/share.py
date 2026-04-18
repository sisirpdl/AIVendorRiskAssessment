import json
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from database import CachedAnswer, Document, SessionLocal, ShareLink
from services.cached_answers import total_questions

router = APIRouter()


class EditPatch(BaseModel):
    verdict: str
    answer: str


class CreateShareRequest(BaseModel):
    tenant_id: str
    document_id: str
    edits: dict[str, EditPatch] = {}


@router.post("/share")
def create_share(req: CreateShareRequest) -> dict:
    with SessionLocal() as session:
        doc = session.get(Document, req.document_id)
        if not doc or doc.tenant_id != req.tenant_id:
            raise HTTPException(status_code=404, detail="Document not found")

        token = secrets.token_urlsafe(16)
        edits_payload = {k: v.model_dump() for k, v in req.edits.items()}
        link = ShareLink(
            token=token,
            tenant_id=req.tenant_id,
            document_id=req.document_id,
            edits_json=json.dumps(edits_payload),
        )
        session.add(link)
        session.commit()
        return {"token": token}


@router.get("/share/{token}")
def get_share(token: str) -> dict:
    with SessionLocal() as session:
        link = session.get(ShareLink, token)
        if not link:
            raise HTTPException(status_code=404, detail="Share link not found or expired")

        doc = session.get(Document, link.document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Underlying document missing")

        rows = session.execute(
            select(CachedAnswer)
            .where(CachedAnswer.document_id == link.document_id)
            .order_by(CachedAnswer.question_id)
        ).scalars().all()

        edits: dict[str, dict] = json.loads(link.edits_json or "{}")

        answers = []
        for r in rows:
            patch = edits.get(r.question_id)
            if patch:
                answers.append(
                    {
                        "question_id": r.question_id,
                        "question": r.question_text,
                        "domain": r.domain,
                        "verdict": patch["verdict"],
                        "answer": patch["answer"],
                        "confidence": 1.0,
                        "idk": False,
                        "source": "manual",
                        "evidence": [],
                        "citations": [],
                        "status": "verified",
                    }
                )
            else:
                answers.append(
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
                        "status": "published",
                    }
                )

        return {
            "token": token,
            "document": {
                "id": doc.id,
                "filename": doc.filename,
                "vendor_id": doc.vendor_id,
                "page_count": doc.page_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            },
            "total": total_questions(),
            "answers": answers,
        }
