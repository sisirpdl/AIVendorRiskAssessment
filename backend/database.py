from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from config import SQLITE_PATH

ENGINE = create_engine(
    f"sqlite:///{SQLITE_PATH}",
    connect_args={"check_same_thread": False},
    future=True,
)

SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    vendor_id: Mapped[str] = mapped_column(String, index=True)
    filename: Mapped[str] = mapped_column(String)
    filepath: Mapped[str] = mapped_column(String)
    doc_version: Mapped[int] = mapped_column(Integer, default=1)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CachedAnswer(Base):
    __tablename__ = "cached_answers"
    __table_args__ = (UniqueConstraint("document_id", "question_id", name="uq_doc_question"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    question_id: Mapped[str] = mapped_column(String, index=True)
    question_text: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String, default="")
    answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verdict: Mapped[str] = mapped_column(String, default="N_A")  # YES | NO | N_A
    source: Mapped[str] = mapped_column(String, default="pdf")  # pdf | web
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    idk: Mapped[bool] = mapped_column(Integer, default=0)  # 0/1 in SQLite
    evidence_json: Mapped[str] = mapped_column(Text, default="[]")
    citations_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ShareLink(Base):
    __tablename__ = "share_links"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), index=True)
    edits_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    vendor_id: Mapped[str] = mapped_column(String, index=True)
    question_id: Mapped[str] = mapped_column(String, index=True)
    old_document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"))
    new_document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"))
    old_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    old_verdict: Mapped[str] = mapped_column(String, default="N_A")
    new_verdict: Mapped[str] = mapped_column(String, default="N_A")
    old_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    new_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    conflict_type: Mapped[str] = mapped_column(String)  # idk_flip / keyword_flip / confidence_drop / semantic
    severity: Mapped[str] = mapped_column(String, default="medium")  # high / medium / low
    status: Mapped[str] = mapped_column(String, default="unresolved")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


def _ensure_columns() -> None:
    """Add columns that were introduced after a db was first created.

    Why: Base.metadata.create_all is idempotent for *tables* but silently skips
    pre-existing tables, so new columns never land without a wipe. For demos we
    want the app to keep starting on an old verifai.db."""
    from sqlalchemy import text

    additions = {
        "conflicts": [
            ("old_verdict", "VARCHAR DEFAULT 'N_A'"),
            ("new_verdict", "VARCHAR DEFAULT 'N_A'"),
            ("severity", "VARCHAR DEFAULT 'medium'"),
        ],
    }
    with ENGINE.begin() as conn:
        for table, cols in additions.items():
            existing = {
                row[1]
                for row in conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            }
            for name, spec in cols:
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {spec}")


def init_db() -> None:
    Base.metadata.create_all(bind=ENGINE)
    _ensure_columns()


def get_session() -> Session:
    return SessionLocal()
