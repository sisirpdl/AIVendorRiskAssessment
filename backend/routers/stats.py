from fastapi import APIRouter, Query
from sqlalchemy import distinct, func, select

from database import CachedAnswer, Conflict, Document, SessionLocal

router = APIRouter()


@router.get("/stats")
def get_stats(tenant_id: str = Query(...)) -> dict:
    with SessionLocal() as session:
        doc_count = session.execute(
            select(func.count(Document.id)).where(Document.tenant_id == tenant_id)
        ).scalar_one()

        vendor_count = session.execute(
            select(func.count(distinct(Document.vendor_id))).where(Document.tenant_id == tenant_id)
        ).scalar_one()

        # "Pending review" = grounded answers that a human hasn't signed off on yet.
        # Until we add a review_status column, treat every non-IDK cached answer as pending.
        pending_reviews = session.execute(
            select(func.count(CachedAnswer.id)).where(
                CachedAnswer.tenant_id == tenant_id,
                CachedAnswer.idk == 0,
            )
        ).scalar_one()

        open_conflicts = session.execute(
            select(func.count(Conflict.id)).where(
                Conflict.tenant_id == tenant_id,
                Conflict.status == "unresolved",
            )
        ).scalar_one()

        return {
            "documents": int(doc_count),
            "vendors": int(vendor_count),
            "pendingReviews": int(pending_reviews),
            "openConflicts": int(open_conflicts),
        }
