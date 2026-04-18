import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
CHROMA_DIR = DATA_DIR / "chroma_db"
SQLITE_PATH = DATA_DIR / "verifai.db"

PDF_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

CLAUDE_MODEL = "claude-sonnet-4-6"
OPENAI_EMBED_MODEL = "text-embedding-3-small"
LOCAL_EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

CHUNK_MAX_TOKENS = 400
CHUNK_OVERLAP_SPANS = 2
RAG_TOP_K = 5
IDK_CONFIDENCE_THRESHOLD = 0.4

DEMO_TENANTS = [
    {"id": "acme", "name": "Acme Corp", "industry": "FinTech"},
    {"id": "globex", "name": "Globex Ltd", "industry": "Healthcare"},
    {"id": "initech", "name": "Initech Inc.", "industry": "SaaS"},
]
