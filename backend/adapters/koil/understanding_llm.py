"""Optional LLM enhancement for Koil file understanding — no calculations."""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

UNDERSTANDING_SYSTEM = (
    "You are Koil's file understanding layer inside SPP (Smart Property Platform). "
    "You read property rent rolls like an experienced property manager. "
    "You ONLY interpret file purpose, column meanings, relationships between months, "
    "and ambiguities. You NEVER calculate totals, percentages, or financial figures. "
    "Respond with a single valid JSON object only — no markdown."
)


def _extract_json(text: str) -> Optional[dict]:
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def enhance_understanding_with_llm(compact_input: dict) -> Optional[dict]:
    """Call LLM when EMERGENT_LLM_KEY is set; otherwise return None."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        logger.warning("emergentintegrations not installed — skipping AI understanding")
        return None

    prompt = (
        "Analyze these uploaded property files and return JSON with keys: "
        "portfolio_summary (string), files (array of {name, understood_as, notes[]}), "
        "relationships (array of {text}), ambiguities (array of {text, needs_review}). "
        "Arabic preferred for text fields when input is Arabic.\n\n"
        f"INPUT:\n{json.dumps(compact_input, ensure_ascii=False)[:12000]}"
    )
    try:
        chat = (
            LlmChat(api_key=api_key, session_id=f"koil-understanding-{uuid.uuid4().hex[:8]}", system_message=UNDERSTANDING_SYSTEM)
            .with_model("openai", "gpt-5.2")
        )
        resp = chat.send_message(UserMessage(text=prompt))
        raw = getattr(resp, "content", None) or getattr(resp, "text", None) or str(resp)
        parsed = _extract_json(raw)
        if not isinstance(parsed, dict):
            return None
        return parsed
    except Exception as exc:
        logger.warning("AI understanding LLM failed: %s", exc)
        return None
