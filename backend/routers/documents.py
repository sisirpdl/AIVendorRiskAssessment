import hashlib
import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from config import PDF_DIR
from database import Document, SessionLocal
from services.cached_answers import run_precompute
from services.chunker import chunk_spans
from services.embedder import embed_texts
from services.pdf_extractor import extract_spans, page_count
from services.vector_store import add_chunks, delete_document as vs_delete_document

router = APIRouter()


def _slugify(name: str) -> str:
    stem = Path(name).stem.lower()
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-") or "vendor"


@router.post("/upload")
def upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tenant_id: str = Query(...),
    vendor_id: Optional[str] = Query(None),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf uploads are supported")

    vendor = vendor_id or _slugify(file.filename)
    document_id = uuid.uuid4().hex
    stored_path = PDF_DIR / f"{document_id}.pdf"

    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    stored_path.write_bytes(raw)
    content_hash = hashlib.sha256(raw).hexdigest()

    with SessionLocal() as session:
        existing_versions = session.execute(
            select(Document.doc_version).where(
                Document.tenant_id == tenant_id,
                Document.vendor_id == vendor,
            )
        ).scalars().all()
        doc_version = max(existing_versions) + 1 if existing_versions else 1

        doc = Document(
            id=document_id,
            tenant_id=tenant_id,
            vendor_id=vendor,
            filename=file.filename,
            filepath=stored_path.as_posix(),
            doc_version=doc_version,
            page_count=0,
            content_hash=content_hash,
            status="processing",
        )
        session.add(doc)
        session.commit()

    try:
        spans = extract_spans(stored_path)
        pages = page_count(stored_path)
        chunks = chunk_spans(spans, document_id=document_id, tenant_id=tenant_id, doc_version=doc_version)
        if chunks:
            embeddings = embed_texts([c["text"] for c in chunks])
            add_chunks(chunks, embeddings)

        with SessionLocal() as session:
            doc_row = session.get(Document, document_id)
            doc_row.page_count = pages
            doc_row.status = "answering"
            session.commit()

        # Kick off CAIQ-50 pre-compute in the background so the client can start polling.
        background_tasks.add_task(run_precompute, document_id, tenant_id)

        return {
            "document_id": document_id,
            "tenant_id": tenant_id,
            "vendor_id": vendor,
            "filename": file.filename,
            "doc_version": doc_version,
            "page_count": pages,
            "chunk_count": len(chunks),
            "status": "answering",
        }
    except Exception as e:
        with SessionLocal() as session:
            doc_row = session.get(Document, document_id)
            if doc_row:
                doc_row.status = "failed"
                session.commit()
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")


@router.get("/{document_id}")
def get_document(document_id: str):
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "document_id": doc.id,
        "tenant_id": doc.tenant_id,
        "vendor_id": doc.vendor_id,
        "filename": doc.filename,
        "doc_version": doc.doc_version,
        "page_count": doc.page_count,
        "status": doc.status,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.get("/{document_id}/file")
def get_file(document_id: str):
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(doc.filepath)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(path, media_type="application/pdf", filename=doc.filename)


@router.get("")
def list_documents(tenant_id: str = Query(...)):
    with SessionLocal() as session:
        rows = session.execute(
            select(Document).where(Document.tenant_id == tenant_id).order_by(Document.created_at.desc())
        ).scalars().all()
        return {
            "documents": [
                {
                    "document_id": d.id,
                    "vendor_id": d.vendor_id,
                    "filename": d.filename,
                    "doc_version": d.doc_version,
                    "page_count": d.page_count,
                    "status": d.status,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in rows
            ]
        }


@router.delete("/{document_id}")
def delete_document(document_id: str, tenant_id: str = Query(...)):
    with SessionLocal() as session:
        doc = session.get(Document, document_id)
        if not doc or doc.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Document not found")
        Path(doc.filepath).unlink(missing_ok=True)
        session.delete(doc)
        session.commit()
    vs_delete_document(document_id)
    return {"deleted": document_id}
