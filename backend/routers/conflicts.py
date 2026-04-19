from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from database import CachedAnswer, Conflict, Document, SessionLocal
from services.cached_answers import question_bank

router = APIRouter()


def _question_lookup() -> dict[str, dict]:
    return {q["id"]: q for q in question_bank()}


def _vendor_name_map() -> dict[str, str]:
    with SessionLocal() as session:
        rows = session.execute(select(Document.vendor_id).distinct()).scalars().all()
    return {v: v.replace("-", " ").replace("_", " ").title() for v in rows}


@router.get("")
def list_conflicts(tenant_id: str = Query(...)) -> dict:
    """Delta Engine output. Populated every time a vendor's second+ document
    is uploaded and precompute detects answer drift against the prior version."""
    questions = _question_lookup()
    vendor_names = _vendor_name_map()

    with SessionLocal() as session:
        rows = session.execute(
            select(Conflict)
            .where(Conflict.tenant_id == tenant_id)
            .order_by(Conflict.created_at.desc())
        ).scalars().all()

        conflicts = []
        for c in rows:
            q = questions.get(c.question_id, {})
            conflicts.append({
                "id": str(c.id),
                "tenant_id": c.tenant_id,
                "vendor_id": c.vendor_id,
                "vendor_name": vendor_names.get(c.vendor_id, c.vendor_id),
                "question_id": c.question_id,
                "question_text": q.get("question", c.question_id),
                "domain": q.get("domain", ""),
                "old_document_id": c.old_document_id,
                "new_document_id": c.new_document_id,
                "old_answer": c.old_answer,
                "new_answer": c.new_answer,
                "old_verdict": c.old_verdict,
                "new_verdict": c.new_verdict,
                "old_confidence": float(c.old_confidence),
                "new_confidence": float(c.new_confidence),
                "conflict_type": c.conflict_type,
                "severity": c.severity,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
        return {"conflicts": conflicts}


class ConflictResolvePatch(BaseModel):
    status: Literal["accepted_new", "accepted_old", "unresolved"]


@router.patch("/{conflict_id}")
def resolve_conflict(
    conflict_id: int,
    patch: ConflictResolvePatch,
    tenant_id: str = Query(...),
) -> dict:
    """Persist the seller's choice of source of truth. If they accept the old
    answer, also overwrite the current cached_answers row so future buyers see
    the restored answer."""
    with SessionLocal() as session:
        c = session.get(Conflict, conflict_id)
        if c is None or c.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Conflict not found")
        c.status = patch.status

        # If the seller accepts the OLD answer, restore it on the cached row
        # so the exported questionnaire shows the reverted commitment. Mark
        # source=manual so the UI knows it was a human decision.
        if patch.status == "accepted_old":
            ca = session.execute(
                select(CachedAnswer).where(
                    CachedAnswer.document_id == c.new_document_id,
                    CachedAnswer.question_id == c.question_id,
                )
            ).scalar_one_or_none()
            if ca is not None:
                ca.verdict = c.old_verdict
                ca.answer = c.old_answer
                ca.confidence = float(c.old_confidence)
                ca.idk = 1 if c.old_verdict == "N_A" else 0
                ca.source = "manual"

        session.commit()
        return {"id": str(c.id), "status": c.status}
