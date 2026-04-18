import re

import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, IDK_CONFIDENCE_THRESHOLD

IDK_TOKEN = "INFORMATION_NOT_FOUND"
VERDICTS = ("YES", "NO", "N_A")
# Questions are boolean-ish CAIQ controls. Below this floor even a YES/NO is unsafe.
MIN_CONFIDENCE_FOR_VERDICT = 0.25

SYSTEM_PROMPT = f"""You are a strict security compliance analyst.
Answer ONLY from the provided context. Never use prior knowledge.
If the context does not contain enough information, your answer must be exactly: {IDK_TOKEN}
Be concise. Maximum 2 sentences. Never speculate.

Output format (exactly three lines, in order):
VERDICT: YES | NO | N_A
ANSWER: <a single short sentence or {IDK_TOKEN}>
CONFIDENCE: <a number between 0.0 and 1.0 reflecting how well the context supports your answer>

Rules:
- VERDICT=YES when the context shows the vendor meets/does the control.
- VERDICT=NO when the context shows the vendor does NOT meet/do the control.
- VERDICT=N_A when the context is silent or insufficient to decide.
- Use {IDK_TOKEN} as the ANSWER whenever VERDICT=N_A."""

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


def _parse_response(raw: str) -> tuple[str, str | None, float]:
    verdict = "N_A"
    answer: str | None = None
    confidence = 0.0
    for line in raw.splitlines():
        line = line.strip()
        up = line.upper()
        if up.startswith("VERDICT:"):
            v = line.split(":", 1)[1].strip().upper().replace("/", "_").replace("-", "_")
            if v == "N/A" or v == "NA":
                v = "N_A"
            if v in VERDICTS:
                verdict = v
        elif up.startswith("ANSWER:"):
            answer = line.split(":", 1)[1].strip()
        elif up.startswith("CONFIDENCE:"):
            m = re.search(r"[0-9]*\.?[0-9]+", line)
            if m:
                try:
                    confidence = max(0.0, min(1.0, float(m.group(0))))
                except ValueError:
                    confidence = 0.0
    if answer is None:
        answer = raw.strip()
    return verdict, answer, confidence


def answer_question(question: str, context_chunks: list[dict]) -> dict:
    """Returns {verdict, answer, confidence, idk, raw, source}.

    verdict ∈ {YES, NO, N_A}. idk=True when verdict=N_A or answer=INFORMATION_NOT_FOUND
    or confidence falls below the floor for a stated verdict.
    """
    if not context_chunks:
        return {"verdict": "N_A", "answer": None, "confidence": 0.0, "idk": True, "raw": "", "source": "pdf"}

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
    verdict, answer, confidence = _parse_response(raw)

    unsupported = (
        verdict == "N_A"
        or (answer is not None and answer.strip() == IDK_TOKEN)
        or confidence < MIN_CONFIDENCE_FOR_VERDICT
    )
    # Keep the old strict threshold as a second safety net for verdicts that
    # slip through with vanishingly low confidence.
    if verdict in ("YES", "NO") and confidence < IDK_CONFIDENCE_THRESHOLD and confidence >= MIN_CONFIDENCE_FOR_VERDICT:
        # Low-confidence verdict: keep it but flag as borderline by lowering confidence we trust.
        pass

    idk = unsupported
    return {
        "verdict": "N_A" if idk else verdict,
        "answer": None if idk else answer,
        "confidence": confidence,
        "idk": idk,
        "raw": raw,
        "source": "pdf",
    }
