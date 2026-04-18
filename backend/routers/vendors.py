import json
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from database import CachedAnswer, Document, SessionLocal
from services.cached_answers import question_bank, total_questions

router = APIRouter()


def _humanize(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()


def _aggregate_answers(answers: list[CachedAnswer]) -> dict:
    """Returns {overall_score, domain_scores, document_count-agnostic stats}.

    overall_score = % of CAIQ questions confidently answered (non-IDK).
    domain_scores[domain] = same ratio per domain.
    """
    total = total_questions()
    domain_totals: dict[str, int] = defaultdict(int)
    for q in question_bank():
        domain_totals[q["domain"]] += 1

    # When a vendor has multiple docs, collapse to the best answer per question.
    best_by_question: dict[str, CachedAnswer] = {}
    for a in answers:
        existing = best_by_question.get(a.question_id)
        if existing is None:
            best_by_question[a.question_id] = a
            continue
        # Prefer non-IDK, then higher confidence.
        if existing.idk and not a.idk:
            best_by_question[a.question_id] = a
        elif existing.idk == a.idk and a.confidence > existing.confidence:
            best_by_question[a.question_id] = a

    resolved = list(best_by_question.values())
    answered = [a for a in resolved if not a.idk]
    overall_score = round(len(answered) / total * 100) if total else 0

    per_domain_answered: dict[str, int] = defaultdict(int)
    for a in answered:
        per_domain_answered[a.domain] += 1

    domain_scores = {
        domain: round(per_domain_answered.get(domain, 0) / domain_totals[domain] * 100)
        if domain_totals[domain]
        else 0
        for domain in domain_totals
    }

    return {
        "overall_score": overall_score,
        "domain_scores": domain_scores,
        "answered_count": len(answered),
        "idk_count": len(resolved) - len(answered),
        "expected_total": total,
    }


@router.get("")
def list_vendors(tenant_id: str = Query(...)) -> dict:
    with SessionLocal() as session:
        docs = session.execute(
            select(Document).where(Document.tenant_id == tenant_id)
        ).scalars().all()

        # Group documents by vendor_id.
        by_vendor: dict[str, list[Document]] = defaultdict(list)
        for d in docs:
            by_vendor[d.vendor_id].append(d)

        # Pull all cached answers for this tenant (one query, partition client-side).
        all_answers = session.execute(
            select(CachedAnswer).where(CachedAnswer.tenant_id == tenant_id)
        ).scalars().all()
        answers_by_doc: dict[str, list[CachedAnswer]] = defaultdict(list)
        for a in all_answers:
            answers_by_doc[a.document_id].append(a)

        vendors = []
        for vid, vdocs in by_vendor.items():
            vdocs_sorted = sorted(vdocs, key=lambda d: d.created_at or "", reverse=True)
            vendor_answers: list[CachedAnswer] = []
            for vd in vdocs_sorted:
                vendor_answers.extend(answers_by_doc.get(vd.id, []))
            agg = _aggregate_answers(vendor_answers)
            last_doc = vdocs_sorted[0]
            vendors.append({
                "id": vid,
                "name": _humanize(vid),
                "tenant_id": tenant_id,
                "document_count": len(vdocs),
                "last_updated": last_doc.created_at.isoformat() if last_doc.created_at else None,
                "overall_score": agg["overall_score"],
                "domain_scores": agg["domain_scores"],
                "answered_count": agg["answered_count"],
                "idk_count": agg["idk_count"],
                "expected_total": agg["expected_total"],
            })

    vendors.sort(key=lambda v: v["name"])
    return {"vendors": vendors}


@router.get("/{vendor_id}")
def get_vendor(vendor_id: str, tenant_id: str = Query(...)) -> dict:
    with SessionLocal() as session:
        docs = session.execute(
            select(Document).where(
                Document.tenant_id == tenant_id,
                Document.vendor_id == vendor_id,
            )
        ).scalars().all()
        if not docs:
            raise HTTPException(status_code=404, detail="Vendor not found")

        docs_sorted = sorted(docs, key=lambda d: d.created_at or "", reverse=True)
        doc_ids = [d.id for d in docs]
        all_answers = session.execute(
            select(CachedAnswer).where(CachedAnswer.document_id.in_(doc_ids))
        ).scalars().all()

        agg = _aggregate_answers(all_answers)

        # Build collapsed-by-question rolled-up answers (best answer per question).
        best_by_question: dict[str, CachedAnswer] = {}
        for a in all_answers:
            ex = best_by_question.get(a.question_id)
            if ex is None or (ex.idk and not a.idk) or (ex.idk == a.idk and a.confidence > ex.confidence):
                best_by_question[a.question_id] = a

        answers = [
            {
                "question_id": a.question_id,
                "question": a.question_text,
                "domain": a.domain,
                "verdict": a.verdict,
                "answer": a.answer,
                "confidence": float(a.confidence),
                "idk": bool(a.idk),
                "source": a.source,
                "evidence": json.loads(a.evidence_json or "[]"),
                "citations": json.loads(a.citations_json or "[]"),
                "status": "pending_review",
                "document_id": a.document_id,
            }
            for a in sorted(best_by_question.values(), key=lambda x: x.question_id)
        ]

        return {
            "id": vendor_id,
            "name": _humanize(vendor_id),
            "tenant_id": tenant_id,
            "document_count": len(docs),
            "last_updated": docs_sorted[0].created_at.isoformat() if docs_sorted[0].created_at else None,
            "overall_score": agg["overall_score"],
            "domain_scores": agg["domain_scores"],
            "answered_count": agg["answered_count"],
            "idk_count": agg["idk_count"],
            "expected_total": agg["expected_total"],
            "documents": [
                {
                    "id": d.id,
                    "filename": d.filename,
                    "doc_version": d.doc_version,
                    "page_count": d.page_count,
                    "status": d.status,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in docs_sorted
            ],
            "answers": answers,
        }
