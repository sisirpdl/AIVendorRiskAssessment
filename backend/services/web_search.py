from typing import Any

import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from services.llm import IDK_TOKEN, VERDICTS, MIN_CONFIDENCE_FOR_VERDICT, _parse_response

SYSTEM_PROMPT_WEB = f"""You are a security compliance analyst evaluating a specific vendor.
Use the web_search tool to find authoritative answers. Prefer, in order:
  1. The vendor's official trust/security/compliance page
  2. The vendor's official product documentation
  3. Published third-party attestations (SOC 2 / ISO 27001 summaries)
  4. Reputable news coverage from the last 24 months
Do NOT answer from prior knowledge. Only answer from the pages returned by web_search.
If the returned pages do not conclusively answer, use VERDICT=N_A.

Output format (exactly three lines, in order):
VERDICT: YES | NO | N_A
ANSWER: <one short sentence or {IDK_TOKEN}>
CONFIDENCE: <a number between 0.0 and 1.0>"""

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set in .env")
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def _extract_text(content: list[Any]) -> str:
    """Concatenate text blocks in order (ignore tool_use / tool_result blocks)."""
    chunks = []
    for b in content:
        if getattr(b, "type", None) == "text":
            chunks.append(b.text)
    return "\n".join(chunks)


def _extract_citations(content: list[Any]) -> list[dict]:
    citations: list[dict] = []
    seen_urls = set()
    for b in content:
        if getattr(b, "type", None) != "web_search_tool_result":
            continue
        inner = getattr(b, "content", []) or []
        for r in inner:
            if isinstance(r, dict):
                url = r.get("url")
                title = r.get("title")
            else:
                url = getattr(r, "url", None)
                title = getattr(r, "title", None)
            if url and url not in seen_urls:
                seen_urls.add(url)
                citations.append({"url": url, "title": title or url})
    return citations


def answer_via_web(question: str, vendor_name: str, max_uses: int = 3) -> dict:
    """Ask Claude to use web_search to answer a compliance question about a vendor.

    Returns {verdict, answer, confidence, idk, raw, source='web', citations}.
    """
    user_prompt = (
        f"The vendor under evaluation is: {vendor_name}.\n"
        f"Use web_search to answer this compliance question about {vendor_name}. "
        f"Start by searching the vendor's official site if possible.\n\n"
        f"Question: {question}"
    )
    try:
        resp = _get_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=600,
            system=SYSTEM_PROMPT_WEB,
            tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": max_uses}],
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as e:
        return {
            "verdict": "N_A",
            "answer": None,
            "confidence": 0.0,
            "idk": True,
            "raw": f"[web search error] {e}",
            "source": "web",
            "citations": [],
        }

    raw = _extract_text(resp.content)
    citations = _extract_citations(resp.content)
    verdict, answer, confidence = _parse_response(raw)

    unsupported = (
        verdict == "N_A"
        or (answer is not None and answer.strip() == IDK_TOKEN)
        or confidence < MIN_CONFIDENCE_FOR_VERDICT
    )
    # If claude couldn't cite any sources, don't trust the verdict.
    if not citations:
        unsupported = True

    idk = unsupported
    return {
        "verdict": "N_A" if idk else verdict,
        "answer": None if idk else answer,
        "confidence": confidence,
        "idk": idk,
        "raw": raw,
        "source": "web",
        "citations": citations,
    }
