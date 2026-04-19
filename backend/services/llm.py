import re

import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, IDK_CONFIDENCE_THRESHOLD

IDK_TOKEN = "INFORMATION_NOT_FOUND"
VERDICTS = ("YES", "NO", "N_A")
MIN_CONFIDENCE_FOR_VERDICT = 0.1

SYSTEM_PROMPT = f"""You are a security compliance analyst reviewing a vendor's documents.
Answer ONLY from the provided context. Never invent facts that aren't supported.

Commit to YES or NO when the context contains SUBSTANTIVE language describing the control — prose that explains the practice, not just the topic name.

A section heading, table-of-contents entry, topic index, list item that only names a control, or page-number reference is NOT evidence. If the only supporting text in the context is a heading/TOC entry (e.g., "3.2 Encryption at Rest ......... 15"), the correct verdict is N_A.

Use VERDICT=N_A when the context is silent, or when it only mentions the topic without describing the control.
Confidence should reflect how directly the prose answers the question (0.3–0.6 for indirect but substantive evidence, 0.7+ for explicit descriptions).

Be concise. Maximum 2 sentences in ANSWER. Never speculate beyond what the context supports.

Output format (exactly three lines, in order):
VERDICT: YES | NO | N_A
ANSWER: <a single short sentence or {IDK_TOKEN}>
CONFIDENCE: <a number between 0.0 and 1.0>

When VERDICT=N_A, ANSWER must be exactly {IDK_TOKEN}."""

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


def answer_question(
    question: str,
    context_chunks: list[dict],
    guidance: str | None = None,
) -> dict:
    """Returns {verdict, answer, confidence, idk, raw, source, model}.

    verdict ∈ {YES, NO, N_A}. idk=True when verdict=N_A or answer=INFORMATION_NOT_FOUND
    or confidence falls below the floor for a stated verdict.

    `guidance` is a per-question keyword hint used on the retrieval side only
    (embedded alongside the question). It is deliberately NOT passed to Claude,
    because priming the model with an explicit keyword list makes it over-eager
    to cite any chunk containing those words — including TOC entries.
    """
    _ = guidance  # retained for signature compat; used upstream in retrieval
    if not context_chunks:
        return {
            "verdict": "N_A", "answer": None, "confidence": 0.0, "idk": True,
            "raw": "", "source": "pdf", "model": CLAUDE_MODEL,
        }

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

    # Keep the verdict whenever Claude commits to YES or NO unless confidence is
    # essentially zero. Only fall back to N_A when Claude itself refused.
    explicitly_refused = (
        verdict == "N_A"
        or (answer is not None and answer.strip() == IDK_TOKEN)
    )
    too_weak = confidence < MIN_CONFIDENCE_FOR_VERDICT
    idk = explicitly_refused or too_weak
    return {
        "verdict": "N_A" if idk else verdict,
        "answer": None if idk else answer,
        "confidence": confidence,
        "idk": idk,
        "raw": raw,
        "source": "pdf",
        "model": CLAUDE_MODEL,
    }
