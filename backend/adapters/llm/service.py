"""LLM Service — orchestrator for the interpretation layer.

Pipeline:
  load AI state → build context → enforce gate → call provider → validate → respond

When AI_ENABLED=false:
  - No external call is made
  - Returns a deterministic fallback response from existing SPP data
  - status = "disabled"
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

from .contracts import LLMRequest, LLMResponse
from .context_builder import build_controlled_context
from .prompts import build_system_prompt, build_user_prompt
from .provider import LLMProvider, get_provider
from .validator import validate_llm_response

logger = logging.getLogger(__name__)


class LLMService:
    """Orchestrates the LLM interpretation pipeline.

    The service is the single entry point for LLM calls. It:
    1. Loads persisted AI state (provided by the caller).
    2. Builds a controlled context (no raw files).
    3. Enforces the consistency gate before calling the LLM.
    4. Calls the provider only when AI_ENABLED=true.
    5. Validates the response.
    6. Returns a typed LLMResponse.
    """

    def __init__(self, provider: Optional[LLMProvider] = None):
        """Initialize with a provider. If None, uses get_provider() from env."""
        self._provider = provider

    @property
    def provider(self) -> Optional[LLMProvider]:
        # Check AI_ENABLED first — even when a provider is injected.
        enabled = os.getenv("AI_ENABLED", "false").lower() in ("1", "true", "yes")
        if not enabled:
            return None
        if self._provider is None:
            self._provider = get_provider()
        return self._provider

    async def respond(
        self,
        request: LLMRequest,
        ai_state: Dict[str, Any],
    ) -> LLMResponse:
        """Process an LLM request.

        Args:
            request: The typed LLM request.
            ai_state: The persisted AI state dict (loaded by the caller).

        Returns:
            LLMResponse with status, answer, citations, and validation info.
        """
        analysis_id = request.analysis_id
        task = request.task

        # 1. Build controlled context from persisted AI state only.
        context = build_controlled_context(
            ai_state,
            task=task,
            question=request.question,
        )

        # 2. Enforce gate before LLM call.
        gate = context.get("normalized_gate") or {}
        gate_status = gate.get("status", "ok")

        # 3. Check if AI is enabled.
        provider = self.provider
        if provider is None or not provider.configured:
            # AI_ENABLED=false or provider not configured.
            return self._disabled_response(
                analysis_id, task, context, gate_status,
            )

        # 4. Build prompts.
        system_prompt = build_system_prompt(context)
        user_prompt = build_user_prompt(task, request.question, context)

        # 5. Call the provider.
        try:
            start = time.monotonic()
            result = await provider.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            latency_ms = result.get("latency_ms") or int((time.monotonic() - start) * 1000)
            answer = result.get("text") or ""
            model = result.get("model", provider.model)
        except TimeoutError:
            return LLMResponse(
                status="failed",
                analysis_id=analysis_id,
                task=task,
                answer="انتهت مهلة الاستعلام. يُرجى المحاولة مرة أخرى.",
                gate_status=gate_status,
                warnings=["Provider timed out"],
            )
        except Exception as exc:
            # Sanitize error — never log full exception details with context.
            logger.warning("LLM provider error: %s", type(exc).__name__)
            return LLMResponse(
                status="failed",
                analysis_id=analysis_id,
                task=task,
                answer="تعذّر الوصول إلى خدمة الذكاء الاصطناعي. يُرجى المحاولة لاحقاً.",
                gate_status=gate_status,
                warnings=[f"Provider error: {type(exc).__name__}"],
            )

        # 6. Validate the response.
        is_valid, warnings = validate_llm_response(answer, context)

        # 7. If validation failed, do NOT return the rejected LLM text to the
        # user. Return a safe deterministic fallback built only from trusted
        # context data. Status is "blocked_for_review" because the LLM output
        # was not safe to surface — the user must review the fallback instead.
        if not is_valid:
            logger.warning("LLM response validation failed: %s", warnings)
            return self._validation_failed_response(
                analysis_id=analysis_id,
                task=task,
                context=context,
                gate_status=gate_status,
                model=model,
                provider_name=provider.name,
                latency_ms=latency_ms,
                warnings=warnings,
            )

        # 8. Validation passed — extract cited decision IDs from the answer.
        used_decision_ids = self._extract_decision_ids(answer, context)

        return LLMResponse(
            status="completed",
            analysis_id=analysis_id,
            task=task,
            answer=answer,
            citations=self._get_citations(context),
            used_decision_ids=used_decision_ids,
            gate_status=gate_status,
            model=model,
            provider=provider.name,
            latency_ms=latency_ms,
            warnings=warnings,
        )

    def _disabled_response(
        self,
        analysis_id: str,
        task: str,
        context: Dict[str, Any],
        gate_status: str,
    ) -> LLMResponse:
        """Generate a deterministic fallback when AI is disabled."""
        # Build a simple Arabic summary from the context.
        nl = context.get("normalized_lifecycle") or {}
        summary = nl.get("summary") or {}
        late_count = summary.get("late_count", 0)
        departed_count = summary.get("departed_count", 0)
        newcomers_count = summary.get("newcomers_count", 0)

        parts = []
        if late_count:
            parts.append(f"يوجد {late_count} مستأجر متأخر")
        if departed_count:
            parts.append(f"{departed_count} مغادرة")
        if newcomers_count:
            parts.append(f"{newcomers_count} دخول")
        if not parts:
            parts.append("لا توجد إشارات حررة")

        answer = f"الملخص التنفيذي: {' · '.join(parts)}."
        if gate_status == "blocked_for_review":
            answer += " توجد تعارضات تحتاج مراجعة قبل الإجراءات التنفيذية."

        return LLMResponse(
            status="disabled",
            analysis_id=analysis_id,
            task=task,
            answer=answer,
            citations=["normalized_lifecycle.summary"],
            used_decision_ids=[],
            gate_status=gate_status,
            model=None,
            provider=None,
            latency_ms=0,
            warnings=["AI_ENABLED=false — using deterministic fallback"],
        )

    def _validation_failed_response(
        self,
        analysis_id: str,
        task: str,
        context: Dict[str, Any],
        gate_status: str,
        model: Optional[str],
        provider_name: Optional[str],
        latency_ms: int,
        warnings: List[str],
    ) -> LLMResponse:
        """Generate a safe deterministic fallback when LLM validation fails.

        The rejected LLM text is NOT included in the response — only trusted
        context data is used (same pattern as _disabled_response). Status is
        "blocked_for_review" because the LLM output was not safe to surface.

        Preserves: analysis_id, task, gate_status, warnings.
        """
        nl = context.get("normalized_lifecycle") or {}
        summary = nl.get("summary") or {}
        late_count = summary.get("late_count", 0)
        departed_count = summary.get("departed_count", 0)
        newcomers_count = summary.get("newcomers_count", 0)

        parts = []
        if late_count:
            parts.append(f"يوجد {late_count} مستأجر متأخر")
        if departed_count:
            parts.append(f"{departed_count} مغادرة")
        if newcomers_count:
            parts.append(f"{newcomers_count} دخول")
        if not parts:
            parts.append("لا توجد إشارات حررة")

        answer = f"الملخص التنفيذي: {' · '.join(parts)}."
        answer += " تعذّر التحقق من صحة الرد — يُرجى المراجعة قبل الإجراءات التنفيذية."

        return LLMResponse(
            status="blocked_for_review",
            analysis_id=analysis_id,
            task=task,
            answer=answer,
            citations=["normalized_lifecycle.summary"],
            used_decision_ids=[],
            gate_status=gate_status,
            model=model,
            provider=provider_name,
            latency_ms=latency_ms,
            warnings=warnings,
        )

    def _get_citations(self, context: Dict[str, Any]) -> list:
        """Extract which context sections were likely used."""
        citations = []
        for key in (
            "canonical_portfolio_summary",
            "property_knowledge_summary",
            "normalized_lifecycle",
            "koil_reasoning",
            "executive_brief",
            "executive_intelligence",
            "unified_smart_decisions",
            "normalized_gate",
        ):
            if context.get(key):
                citations.append(key)
        return citations

    def _extract_decision_ids(
        self, answer: str, context: Dict[str, Any],
    ) -> list:
        """Extract decision IDs mentioned in the answer."""
        ids = set()
        # Look for IDs from context that appear in the answer.
        for d in (context.get("unified_smart_decisions") or []):
            did = d.get("id", "")
            if did and did in answer:
                ids.add(did)
        return list(ids)
