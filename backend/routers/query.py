from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from config import RAG_TOP_K
from services.embedder import embed_texts
from services.llm import answer_question
from services.vector_store import query_chunks

router = APIRouter()


class Bbox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float


class EvidenceChunk(BaseModel):
    chunk_id: str
    document_id: str
    page_number: int
    text: str
    bbox: Bbox
    span_bboxes: list[Bbox]
    page_width: float
    page_height: float
    relevance_score: float


class QueryRequest(BaseModel):
    question: str
    tenant_id: str
    document_id: Optional[str] = None
    top_k: int = Field(default=RAG_TOP_K, ge=1, le=20)


class QueryAnswer(BaseModel):
    question: str
    answer: Optional[str]
    confidence: float
    idk: bool
    evidence: list[EvidenceChunk]


def _to_bbox(arr: list[float]) -> Bbox:
    return Bbox(x0=arr[0], y0=arr[1], x1=arr[2], y1=arr[3])


@router.post("/query", response_model=QueryAnswer)
def query(req: QueryRequest) -> QueryAnswer:
    q_vec = embed_texts([req.question])[0]
    hits = query_chunks(q_vec, tenant_id=req.tenant_id, top_k=req.top_k, document_id=req.document_id)

    llm_result = answer_question(req.question, hits)

    evidence = [
        EvidenceChunk(
            chunk_id=h["chunk_id"],
            document_id=h["document_id"],
            page_number=h["page_number"],
            text=h["text"],
            bbox=_to_bbox(h["bbox"]),
            span_bboxes=[_to_bbox(b) for b in h["span_bboxes"]],
            page_width=h["page_width"],
            page_height=h["page_height"],
            relevance_score=h["relevance_score"],
        )
        for h in hits
    ]

    return QueryAnswer(
        question=req.question,
        answer=llm_result["answer"],
        confidence=llm_result["confidence"],
        idk=llm_result["idk"],
        evidence=evidence,
    )
