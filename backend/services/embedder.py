from config import LOCAL_EMBED_MODEL

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer(LOCAL_EMBED_MODEL)
    return _local_model


def _embed_local(texts: list[str]) -> list[list[float]]:
    model = _get_local_model()
    vectors = model.encode(texts, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=True)
    return vectors.tolist()


# ---------------------------------------------------------------------------
# OpenAI branch — SCAFFOLDED BUT DISABLED. Do not uncomment unless you also
# wipe backend/data/chroma_db/ and re-embed everything.
# TODO: Vector dimensions differ: local all-MiniLM-L6-v2 = 384, OpenAI
#       text-embedding-3-small = 1536. Mixing them in the same ChromaDB
#       collection will raise a dimensionality error on query.
#
# from openai import OpenAI
# from config import OPENAI_API_KEY, OPENAI_EMBED_MODEL
#
# _openai_client = None
#
# def _get_openai_client():
#     global _openai_client
#     if _openai_client is None:
#         _openai_client = OpenAI(api_key=OPENAI_API_KEY)
#     return _openai_client
#
# def _embed_openai(texts: list[str]) -> list[list[float]]:
#     client = _get_openai_client()
#     resp = client.embeddings.create(model=OPENAI_EMBED_MODEL, input=texts)
#     return [d.embedding for d in resp.data]
# ---------------------------------------------------------------------------


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns one float vector per input.

    Default (and only active) path: local sentence-transformers all-MiniLM-L6-v2 (384-d).
    To switch to OpenAI later: paste OPENAI_API_KEY into .env, uncomment the OpenAI
    block above, wipe backend/data/chroma_db/, and uncomment the dispatcher line below.
    """
    # if OPENAI_API_KEY:
    #     return _embed_openai(texts)
    return _embed_local(texts)
