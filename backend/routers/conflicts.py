import json

from fastapi import APIRouter, Query
from sqlalchemy import select

from database import Conflict, SessionLocal

router = APIRouter()


@router.get("")
def list_conflicts(tenant_id: str = Query(...)) -> dict:
    """Delta Engine output. Empty until Phase 2 is built — the Conflict table exists
    but no service writes to it yet."""
    with SessionLocal() as session:
        rows = session.execute(
            select(Conflict).where(Conflict.tenant_id == tenant_id).order_by(Conflict.created_at.desc())
        ).scalars().all()
        return {
            "conflicts": [
                {
                    "id": str(c.id),
                    "tenant_id": c.tenant_id,
                    "vendor_id": c.vendor_id,
                    "question_id": c.question_id,
                    "old_document_id": c.old_document_id,
                    "new_document_id": c.new_document_id,
                    "old_answer": c.old_answer,
                    "new_answer": c.new_answer,
                    "old_confidence": float(c.old_confidence),
                    "new_confidence": float(c.new_confidence),
                    "conflict_type": c.conflict_type,
                    "status": c.status,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in rows
            ]
        }
