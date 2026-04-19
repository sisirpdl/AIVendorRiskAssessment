from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ANTHROPIC_API_KEY, CHROMA_DIR, DEMO_TENANTS, PDF_DIR, SQLITE_PATH
from database import init_db
from routers import answers, conflicts, documents, query, share, stats, vendors


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
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:3000",
        "http://localhost:5173",
        "https://localhost:8080",
        "https://localhost:8081",
        "https://localhost:3000",
        "https://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:8080",
        "https://127.0.0.1:8081",
        "https://127.0.0.1:3000",
        "https://127.0.0.1:5173",
    ],
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


app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(query.router, prefix="/api", tags=["query"])
app.include_router(answers.router, prefix="/api", tags=["answers"])
app.include_router(vendors.router, prefix="/api/vendors", tags=["vendors"])
app.include_router(stats.router, prefix="/api", tags=["stats"])
app.include_router(conflicts.router, prefix="/api/conflicts", tags=["conflicts"])
app.include_router(share.router, prefix="/api", tags=["share"])
