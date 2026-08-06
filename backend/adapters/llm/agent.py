"""Koil Agent — Layer 5: decide, don't just describe.

This is the difference between "an assistant that answers questions about
the data" and "an employee that manages the property": given the unified
decision list, the agent either

  a) asks the configured LLM (with tool-use) to pick which open decision
     is the single most valuable one to act on right now and why, or
  b) falls back to the deterministic top-score-unblocked pick when AI is
     disabled/unconfigured/fails — Koil always has an opinion, it just
     gets sharper when a strong model is attached.

The agent NEVER calls the execution side-effects itself — it only
*recommends* which decision_id to execute and why. The caller (the API
route) is responsible for calling ``adapters.koil.action_executor`` to do
the actual drafting/logging. This keeps "decide" and "act" separately
auditable, matching this codebase's existing gate-before-LLM philosophy.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from adapters.koil.action_executor import choose_best_action

from .provider import LLMProvider

logger = logging.getLogger(__name__)


_PICK_TOOL = {
    "name": "pick_next_action",
    "description": (
        "Choose the single unified decision (by id) that Koil, acting as a "
        "professional property manager, should act on right now, and give "
        "a one-sentence Arabic justification."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "decision_id": {
                "type": "string",
                "description": "The id of the chosen decision from the provided list.",
            },
            "reason_ar": {
                "type": "string",
                "description": "One short Arabic sentence explaining why this is the priority now.",
            },
        },
        "required": ["decision_id", "reason_ar"],
    },
}


def _candidate_summaries(ai_state: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for d in ai_state.get("unified_smart_decisions") or []:
        if d.get("blocked_by_gate"):
            continue
        if str(d.get("status") or "").casefold() in {"resolved", "executed", "dismissed"}:
            continue
        out.append({
            "id": d.get("id"),
            "kind": d.get("kind"),
            "title": d.get("title"),
            "why": d.get("why"),
            "score": d.get("score"),
            "priority": d.get("priority"),
            "financial_impact": d.get("financial_impact"),
        })
    # Cap what we send to the model — score-sorted top slice is enough context.
    out.sort(key=lambda x: float(x.get("score") or 0), reverse=True)
    return out[:15]


async def decide_next_action(
    ai_state: Dict[str, Any],
    provider: Optional[LLMProvider],
) -> Dict[str, Any]:
    """Return {decision_id, reason, source: 'llm'|'deterministic', decision}.

    Always returns a usable pick when any open decision exists (or
    decision=None when the queue is empty) — the LLM path only refines
    *which* item is chosen and *why*, it never blocks the pick.
    """
    fallback_decision = choose_best_action(ai_state)
    fallback = {
        "decision_id": fallback_decision.get("id") if fallback_decision else None,
        "reason": (fallback_decision or {}).get("why") or "أعلى أولوية غير محظورة حالياً.",
        "source": "deterministic",
        "decision": fallback_decision,
    }

    if provider is None or not provider.configured:
        return fallback

    candidates = _candidate_summaries(ai_state)
    if not candidates:
        return fallback

    system_prompt = (
        "أنت كويل، موظف عقاري ذكي محترف يدير محفظة عقارية نيابة عن المالك. "
        "أمامك قائمة قرارات مرشحة (JSON). اختر واحداً فقط لتنفيذه الآن "
        "باستخدام أداة pick_next_action. لا تخترع بيانات غير موجودة في القائمة."
    )
    user_prompt = (
        "القرارات المرشحة:\n```json\n" + json.dumps(candidates, ensure_ascii=False) + "\n```"
    )

    try:
        result = await provider.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=400,
            **({"tools": [_PICK_TOOL]} if _provider_supports_tools(provider) else {}),
        )
    except Exception as exc:  # noqa: BLE001 - never let agent picking break execution
        logger.warning("Koil agent decide_next_action failed: %s", type(exc).__name__)
        return fallback

    tool_calls = result.get("tool_calls") or []
    picked_id = None
    reason = None
    for call in tool_calls:
        if call.get("name") == "pick_next_action":
            picked_id = str((call.get("input") or {}).get("decision_id") or "")
            reason = str((call.get("input") or {}).get("reason_ar") or "")
            break

    if not picked_id:
        # Model answered in plain text instead of calling the tool, or the
        # provider doesn't support tools — keep the deterministic pick but
        # surface any prose reasoning it gave, if present.
        text = str(result.get("text") or "").strip()
        if text:
            fallback = {**fallback, "reason": text[:400]}
        return fallback

    valid_ids = {c["id"] for c in candidates}
    if picked_id not in valid_ids:
        logger.warning("Koil agent picked an id outside the offered candidates — using fallback")
        return fallback

    decision = next(
        (d for d in ai_state.get("unified_smart_decisions") or [] if str(d.get("id")) == picked_id),
        None,
    )
    return {
        "decision_id": picked_id,
        "reason": reason or fallback["reason"],
        "source": "llm",
        "decision": decision,
    }


def _provider_supports_tools(provider: LLMProvider) -> bool:
    """Tool-use for pick_next_action.

    Supported:
      - anthropic (native Messages tools)
      - openai / OpenAICompatibleProvider (incl. Gemini OpenAI-compatible endpoint)
    """
    return getattr(provider, "name", "") in {"anthropic", "openai"}
