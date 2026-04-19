import io
import json
import re
import secrets
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select

from database import CachedAnswer, Document, SessionLocal, ShareLink
from services.cached_answers import total_questions

router = APIRouter()


def _safe_filename(name: str) -> str:
    """Strip path traversal and Windows-illegal chars for inclusion in a ZIP."""
    base = Path(name).name or "document.pdf"
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", base)


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

        # Every document under this vendor (to resolve multi-doc evidence citations)
        vendor_docs = session.execute(
            select(Document).where(
                Document.tenant_id == link.tenant_id,
                Document.vendor_id == doc.vendor_id,
            )
        ).scalars().all()

        return {
            "token": token,
            "document": {
                "id": doc.id,
                "filename": doc.filename,
                "vendor_id": doc.vendor_id,
                "page_count": doc.page_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            },
            "documents": [
                {
                    "id": d.id,
                    "filename": d.filename,
                    "page_count": d.page_count,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in vendor_docs
            ],
            "total": total_questions(),
            "answers": answers,
        }


@router.get("/share/{token}/source.zip")
def get_share_source_zip(token: str) -> Response:
    """Bundle every source PDF attached to the vendor on this share into a ZIP.

    Public endpoint (same auth model as /share/{token}): anyone with the token
    can grab the underlying evidence. Vendor-scoped — not tenant-wide.
    """
    with SessionLocal() as session:
        link = session.get(ShareLink, token)
        if not link:
            raise HTTPException(status_code=404, detail="Share link not found or expired")

        primary = session.get(Document, link.document_id)
        if not primary:
            raise HTTPException(status_code=404, detail="Underlying document missing")

        docs = session.execute(
            select(Document).where(
                Document.tenant_id == link.tenant_id,
                Document.vendor_id == primary.vendor_id,
            )
        ).scalars().all()

    buf = io.BytesIO()
    seen: dict[str, int] = {}
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for d in docs:
            path = Path(d.filepath)
            if not path.exists():
                continue
            name = _safe_filename(d.filename)
            # De-dupe names inside the zip (two docs with same filename).
            count = seen.get(name, 0)
            if count:
                stem = Path(name).stem
                ext = Path(name).suffix
                name = f"{stem} ({count}){ext}"
            seen[Path(name).name] = count + 1
            seen[name] = 1
            zf.write(path, arcname=name)

    archive_name = _safe_filename(f"{primary.vendor_id}-source-reports.zip")
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{archive_name}"'},
    )
