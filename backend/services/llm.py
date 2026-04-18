import re

import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, IDK_CONFIDENCE_THRESHOLD

IDK_TOKEN = "INFORMATION_NOT_FOUND"

SYSTEM_PROMPT = f"""You are a strict security compliance analyst.
Answer ONLY from the provided context. Never use prior knowledge.
If the context does not contain enough information, your answer must be exactly: {IDK_TOKEN}
Be concise. Maximum 2 sentences. Never speculate.

Output format (exactly two lines):
ANSWER: <your answer, or {IDK_TOKEN}>
CONFIDENCE: <a number between 0.0 and 1.0 reflecting how well the context supports your answer>"""

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set in .env")
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def _format_context(chunks: list[dict]) -> str:
    lines = []
    for i, c in enumerate(chunks, start=1):
        lines.append(f"[{i}] (page {c['page_number']}) {c['text']}")
    return "\n\n".join(lines)


def _parse_response(raw: str) -> tuple[str | None, float]:
    answer: str | None = None
    confidence = 0.0
    for line in raw.splitlines():
        line = line.strip()
        if line.upper().startswith("ANSWER:"):
            answer = line.split(":", 1)[1].strip()
        elif line.upper().startswith("CONFIDENCE:"):
            m = re.search(r"[0-9]*\.?[0-9]+", line)
            if m:
                try:
                    confidence = max(0.0, min(1.0, float(m.group(0))))
                except ValueError:
                    confidence = 0.0
    # Fallback: if Claude skipped the ANSWER: prefix, treat whole text as the answer.
    if answer is None:
        answer = raw.strip()
    return answer, confidence


def answer_question(question: str, context_chunks: list[dict]) -> dict:
    """Returns {answer: str|None, confidence: float, idk: bool, raw: str}.

    answer=None and idk=True when the model returns INFORMATION_NOT_FOUND, when
    confidence falls below IDK_CONFIDENCE_THRESHOLD, or when no context is provided.
    """
    if not context_chunks:
        return {"answer": None, "confidence": 0.0, "idk": True, "raw": ""}

    user_prompt = (
        f"Context:\n{_format_context(context_chunks)}\n\n"
        f"Question: {question}"
    )

    resp = _get_client().messages.create(
        model=CLAUDE_MODEL,
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = resp.content[0].text
    answer, confidence = _parse_response(raw)

    idk = answer is None or answer.strip() == IDK_TOKEN or confidence < IDK_CONFIDENCE_THRESHOLD
    return {
        "answer": None if idk else answer,
        "confidence": confidence,
        "idk": idk,
        "raw": raw,
    }
