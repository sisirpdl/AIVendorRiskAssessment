"""Delta Engine — Phase 2.

Detects when a newly uploaded document changes a vendor's previously-answered
CAIQ row. Writes rows into the `conflicts` table so the Seller app can surface
silent drift ("vendor quietly removed MFA commitment").

Invoked from cached_answers.run_precompute AFTER pass 2 completes. The snapshot
of the prior answer set must be captured BEFORE pass 1 wipes the table.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from database import CachedAnswer, Conflict, SessionLocal

# A confidence drop this big (or bigger) between the old and the new verdict
# is surfaced as a conflict even when both say YES — the evidence got weaker.
CONFIDENCE_DROP_THRESHOLD = 0.3


def snapshot_answers(document_ids: list[str]) -> dict[str, dict]:
    """Freeze the current cached_answers rows for a vendor before precompute
    wipes them. Returns {question_id: {verdict, answer, confidence, idk, document_id}}."""
    if not document_ids:
        return {}
    with SessionLocal() as session:
        rows = session.execute(
            select(CachedAnswer).where(CachedAnswer.document_id.in_(document_ids))
        ).scalars().all()
        return {
            r.question_id: {
                "verdict": r.verdict,
                "answer": r.answer,
                "confidence": float(r.confidence),
                "idk": bool(r.idk),
                "document_id": r.document_id,
            }
            for r in rows
        }


def _classify(old: dict, new: dict) -> Optional[tuple[str, str]]:
    """Return (conflict_type, severity) or None if the pair is not a conflict.

    Types:
      idk_flip       — IDK ↔ answered (either direction)
      keyword_flip   — both answered but verdicts differ (YES vs NO)
      confidence_drop — same verdict, but confidence fell by >= threshold
    Severity is a quick heuristic that the UI can color-code.
    """
    # IDK flipped either way — we learned something we didn't know (or lost it).
    if old["idk"] != new["idk"]:
        # YES → IDK or NO → IDK is scarier than IDK → YES.
        severity = "high" if old["idk"] is False and new["idk"] is True else "medium"
        return ("idk_flip", severity)

    # Both answered, verdicts disagree.
    if not old["idk"] and not new["idk"] and old["verdict"] != new["verdict"]:
        # YES → NO on a security question is the worst kind of drift.
        severity = "high" if {old["verdict"], new["verdict"]} == {"YES", "NO"} else "medium"
        return ("keyword_flip", severity)

    # Same verdict but evidence weakened substantially.
    if old["verdict"] == new["verdict"] and not old["idk"] and not new["idk"]:
        delta = old["confidence"] - new["confidence"]
        if delta >= CONFIDENCE_DROP_THRESHOLD:
            return ("confidence_drop", "low" if delta < 0.5 else "medium")

    return None


def detect_and_persist_conflicts(
    tenant_id: str,
    vendor_id: str,
    new_document_id: str,
    old_snapshot: dict[str, dict],
) -> int:
    """Compare old_snapshot to the freshly-written cached_answers for new_document_id
    and insert Conflict rows for every change that matters. Returns the count
    of conflicts written."""
    if not old_snapshot:
        return 0

    with SessionLocal() as session:
        new_rows = session.execute(
            select(CachedAnswer).where(CachedAnswer.document_id == new_document_id)
        ).scalars().all()
        new_by_q = {
            r.question_id: {
                "verdict": r.verdict,
                "answer": r.answer,
                "confidence": float(r.confidence),
                "idk": bool(r.idk),
            }
            for r in new_rows
        }

        written = 0
        for qid, old in old_snapshot.items():
            new = new_by_q.get(qid)
            if new is None:
                continue
            classification = _classify(old, new)
            if classification is None:
                continue
            conflict_type, severity = classification
            session.add(Conflict(
                tenant_id=tenant_id,
                vendor_id=vendor_id,
                question_id=qid,
                old_document_id=old["document_id"],
                new_document_id=new_document_id,
                old_answer=old["answer"],
                new_answer=new["answer"],
                old_verdict=old["verdict"],
                new_verdict=new["verdict"],
                old_confidence=old["confidence"],
                new_confidence=new["confidence"],
                conflict_type=conflict_type,
                severity=severity,
                status="unresolved",
            ))
            written += 1
        session.commit()
        return written
