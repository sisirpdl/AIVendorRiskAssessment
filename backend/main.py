from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ANTHROPIC_API_KEY, CHROMA_DIR, DEMO_TENANTS, PDF_DIR, SQLITE_PATH
from database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if not ANTHROPIC_API_KEY:
        print("[warn] ANTHROPIC_API_KEY is empty — /query will fail until set in .env")
    print(f"[startup] pdfs={PDF_DIR}  chroma={CHROMA_DIR}  sqlite={SQLITE_PATH}")
    yield


app = FastAPI(title="AI Vendor Risk Assessment", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/tenants")
def tenants() -> dict:
    return {"tenants": DEMO_TENANTS}


# Routers (wired in later steps):
# from routers import documents, query
# app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
# app.include_router(query.router, prefix="/api", tags=["query"])
