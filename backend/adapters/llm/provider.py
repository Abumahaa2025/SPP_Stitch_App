"""Provider abstraction — one concrete adapter + fake provider for tests.

Uses OpenAI-compatible HTTP API (works with OpenAI, Azure OpenAI, or any
OpenAI-API-compatible endpoint). No heavy SDK dependency — direct httpx calls.

Configuration (all environment-based, no hardcoding):
    AI_PROVIDER=openai
    AI_MODEL=gpt-4o
    AI_API_KEY=<secret>
    AI_TIMEOUT_SECONDS=60
    AI_MAX_RETRIES=2
    AI_ENABLED=false
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)

# Security: never log the API key or the full prompt.
# Only log provider name, model, task, latency, and status.


class LLMProvider(Protocol):
    """Protocol for LLM providers."""

    @property
    def name(self) -> str: ...

    @property
    def model(self) -> str: ...

    @property
    def configured(self) -> bool: ...

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Dict[str, Any]:
        """Generate a response. Returns {text, model, latency_ms} or raises."""
        ...


class OpenAICompatibleProvider:
    """Concrete provider using OpenAI-compatible chat completions API.

    Uses direct HTTP via httpx — no SDK dependency. Works with any
    OpenAI-API-compatible endpoint (OpenAI, Azure, local LLMs, etc.).
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        timeout_seconds: int = 60,
        max_retries: int = 2,
    ):
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._max_retries = max_retries

    @property
    def name(self) -> str:
        return "openai"

    @property
    def model(self) -> str:
        return self._model

    @property
    def configured(self) -> bool:
        return bool(self._api_key and self._model)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Dict[str, Any]:
        """Call the OpenAI-compatible chat completions endpoint.

        Returns:
            {text: str, model: str, latency_ms: int}

        Raises:
            TimeoutError: if the request times out after retries.
            RuntimeError: if the API returns an error after retries.
        """
        import httpx  # local import — keeps startup fast when AI_ENABLED=false

        url = f"{self._base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.3,  # low temperature for factual responses
        }

        last_error: Optional[Exception] = None
        for attempt in range(self._max_retries + 1):
            try:
                start = time.monotonic()
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(url, json=body, headers=headers)

                latency_ms = int((time.monotonic() - start) * 1000)

                if resp.status_code != 200:
                    # Sanitize error — never log the full response body.
                    error_detail = _sanitize_error(resp.text)
                    raise RuntimeError(f"API returned {resp.status_code}: {error_detail}")

                data = resp.json()
                text = ""
                choices = data.get("choices") or []
                if choices:
                    text = choices[0].get("message", {}).get("content", "")

                return {
                    "text": text.strip(),
                    "model": data.get("model", self._model),
                    "latency_ms": latency_ms,
                }

            except httpx.TimeoutException:
                last_error = TimeoutError(f"Provider timed out after {self._timeout}s (attempt {attempt + 1})")
                logger.warning("LLM provider timeout (attempt %d/%d)", attempt + 1, self._max_retries + 1)
                continue
            except httpx.HTTPError as exc:
                last_error = RuntimeError(f"HTTP error: {_sanitize_error(str(exc))}")
                logger.warning("LLM provider HTTP error (attempt %d/%d)", attempt + 1, self._max_retries + 1)
                continue

        raise last_error or RuntimeError("LLM provider failed after retries")


def _sanitize_error(text: str) -> str:
    """Remove any potential secrets from error messages before logging."""
    # Truncate to 200 chars and remove any key-like patterns.
    text = text[:200]
    # Remove anything that looks like a Bearer token or API key.
    import re
    text = re.sub(r"(?:Bearer\s+|sk-|key-)[A-Za-z0-9\-_]+", "[REDACTED]", text)
    return text


class FakeProvider:
    """Fake LLM provider for tests.

    Supports configurable behaviors:
    - valid: returns a valid Arabic response
    - timeout: raises TimeoutError
    - malformed: returns a non-string response
    - invented_financial: returns a response with invented financial values
    - unknown_tenant: returns a response mentioning an unknown tenant
    - gate_contradiction: returns a response contradicting a blocked gate
    - failure: raises RuntimeError
    """

    def __init__(
        self,
        mode: str = "valid",
        custom_response: Optional[str] = None,
    ):
        self._mode = mode
        self._custom_response = custom_response
        self._call_count = 0

    @property
    def name(self) -> str:
        return "fake"

    @property
    def model(self) -> str:
        return "fake-model"

    @property
    def configured(self) -> bool:
        return True

    @property
    def call_count(self) -> int:
        return self._call_count

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Dict[str, Any]:
        self._call_count += 1

        if self._mode == "timeout":
            raise TimeoutError("Fake provider timed out")

        if self._mode == "failure":
            raise RuntimeError("Fake provider failure")

        if self._mode == "malformed":
            return {"text": None, "model": "fake-model", "latency_ms": 10}

        # For valid/invented_financial/unknown_tenant/gate_contradiction
        if self._custom_response:
            text = self._custom_response
        elif self._mode == "invented_financial":
            text = "إجمالي الإيرادات 999,999 ريال وهذا مبلغ لم يرد في البيانات."
        elif self._mode == "unknown_tenant":
            text = "المستأجر أحمد العتيبي في الوحدة 999 لديه متأخرات."
        elif self._mode == "gate_contradiction":
            text = "تم تأكيد مغادرة المستأجر خالد من الوحدة 101 بشكل نهائي."
        else:
            # valid — context-aware: parse the system prompt to extract
            # real entities from the controlled context and generate a
            # realistic Arabic answer that cites them.
            text = _generate_context_aware_answer(system_prompt, user_prompt)

        return {"text": text, "model": "fake-model", "latency_ms": 15}


def _generate_context_aware_answer(system_prompt: str, user_prompt: str) -> str:
    """Generate a realistic Arabic answer from the controlled context.

    The system prompt contains the context as JSON. This function parses
    it and produces an answer that:
    - cites real tenant names and unit labels
    - cites real decision IDs
    - explains WHY recommendations exist (tracing to lifecycle/Koïl/intelligence)
    - respects gate status (review language when blocked)
    - never invents financial values
    """
    import json as _json
    import re as _re

    # Extract the JSON context from the system prompt.
    context = {}
    m = _re.search(r"```json\n(\{.*?\})\n```", system_prompt, _re.DOTALL)
    if m:
        try:
            context = _json.loads(m.group(1))
        except Exception:
            pass

    if not context:
        return "لا توجد بيانات متاحة للإجابة."

    # Extract real entities from context.
    nl = context.get("normalized_lifecycle") or {}
    summary = nl.get("summary") or {}
    late_tenants = nl.get("late_tenants") or []
    departed = nl.get("departed") or []
    newcomers = nl.get("newcomers") or []
    month_comparison = nl.get("month_comparison") or []

    decisions = context.get("unified_smart_decisions") or []
    gate = context.get("normalized_gate") or {}
    gate_status = gate.get("status", "ok")

    ei = context.get("executive_intelligence") or {}
    insights = ei.get("insights") or []

    kr = context.get("koil_reasoning") or {}
    koil_brief = kr.get("brief", "")

    pks = context.get("property_knowledge_summary") or {}

    # Determine the task from the user prompt.
    user_lower = user_prompt.lower()
    is_executive_summary = "ملخص" in user_lower or "executive" in user_lower or "حالة" in user_lower
    is_follow_up = "متابعة" in user_lower or "follow" in user_lower or "أسبوع" in user_lower
    is_explanation = "لماذا" in user_lower or "why" in user_lower or "اشرح" in user_lower
    is_absent_data = "مارس" in user_lower or "march" in user_lower

    # --- If asking about absent data, refuse ---
    if is_absent_data:
        return (
            "لا توجد بيانات متاحة عن شهر مارس في السجل المستورد. "
            "البيانات المتوفرة تغطي يناير وفبراير 2026 فقط."
        )

    # --- Build answer from real context entities ---
    parts: List[str] = []

    if gate_status == "blocked_for_review":
        parts.append("توجد مؤشرات تحتاج مراجعة قبل الإجراءات التنفيذية.")

    # Executive summary: what happened this month
    if is_executive_summary or (not is_follow_up and not is_explanation):
        late_count = summary.get("late_count", 0)
        departed_count = summary.get("departed_count", 0)
        newcomers_count = summary.get("newcomers_count", 0)

        if late_count > 0 and late_tenants:
            lt = late_tenants[0]
            parts.append(
                f"يوجد {late_count} مستأجر متأخر: {lt.get('tenant', '—')} "
                f"في الوحدة {lt.get('unit', '—')} بمتأخرات "
                f"{int(float(lt.get('total_unpaid', 0)))} ريال "
                f"لمدة {lt.get('late_month_count', 0)} شهر."
            )

        if departed_count > 0 and departed:
            d = departed[0]
            parts.append(
                f"غادر المستأجر {d.get('tenant', '—')} الوحدة {d.get('unit', '—')}."
            )

        if newcomers_count > 0 and newcomers:
            n = newcomers[0]
            parts.append(
                f"دخل مستأجر جديد: {n.get('tenant', '—')} في الوحدة {n.get('unit', '—')}."
            )

        # Cite top decision
        if decisions:
            top = decisions[0]
            parts.append(
                f"الإجراء الموصى به: {top.get('title', '—')} "
                f"(قرار: {top.get('id', '—')})."
            )

        # Cite intelligence insight
        if insights:
            ins = insights[0]
            parts.append(
                f"تنبيه ذكاء: {ins.get('headline', '—')} "
                f"(ثقة {ins.get('confidence', 0)}%)."
            )

    # Follow-up: who needs attention this week
    elif is_follow_up:
        # List top decisions with tenant/unit refs
        for d in decisions[:5]:
            if d.get("blocked_by_gate"):
                parts.append(
                    f"متابعة: {d.get('title', '—')} — "
                    f"محظور بوابة الاتساق، يحتاج مراجعة (قرار: {d.get('id', '—')})."
                )
            else:
                tenant = d.get("tenant_name") or "—"
                unit = d.get("unit_label") or "—"
                conf = d.get("confidence", 0)
                parts.append(
                    f"متابعة: {d.get('title', '—')} — "
                    f"المستأجر: {tenant}، الوحدة: {unit}، "
                    f"الثقة: {conf}% (قرار: {d.get('id', '—')})."
                )

    # Explanation: why recommend contacting tenant
    elif is_explanation:
        # Find the contact_late_tenant decision
        contact_dec = next(
            (d for d in decisions if d.get("kind") == "contact_late_tenant"),
            None,
        )
        if contact_dec:
            tenant = contact_dec.get("tenant_name") or "—"
            unit = contact_dec.get("unit_label") or "—"
            parts.append(
                f"التوصية بالتواصل مع المستأجر {tenant} في الوحدة {unit} "
                f"مبنية على:"
            )
            # Trace to lifecycle
            if late_tenants:
                lt = late_tenants[0]
                parts.append(
                    f"دورة الحياة: متأخر {lt.get('late_month_count', 0)} شهر "
                    f"بإجمالي {int(float(lt.get('total_unpaid', 0)))} ريال."
                )
            # Trace to Koïl
            if koil_brief:
                parts.append(f"كويل: {koil_brief}")
            # Cite decision ID
            parts.append(f"رقم القرار: {contact_dec.get('id', '—')}.")
            # Cite confidence
            parts.append(f"مستوى الثقة: {contact_dec.get('confidence', 0)}%.")
        else:
            # Explain the top decision
            if decisions:
                top = decisions[0]
                parts.append(
                    f"التوصية: {top.get('title', '—')} "
                    f"(قرار: {top.get('id', '—')})."
                )

    return " ".join(parts) if parts else "لا توجد توصيات متاحة."


def get_provider() -> Optional[LLMProvider]:
    """Get the configured LLM provider from environment variables.

    Returns None when AI_ENABLED=false or when the provider is not configured.
    Never hardcodes any provider key or model.
    """
    enabled = os.getenv("AI_ENABLED", "false").lower() in ("1", "true", "yes")
    if not enabled:
        return None

    provider_name = os.getenv("AI_PROVIDER", "").lower()
    api_key = os.getenv("AI_API_KEY", "")
    model = os.getenv("AI_MODEL", "")
    timeout = int(os.getenv("AI_TIMEOUT_SECONDS", "60"))
    retries = int(os.getenv("AI_MAX_RETRIES", "2"))
    base_url = os.getenv("AI_BASE_URL", "https://api.openai.com/v1")

    if not api_key or not model:
        logger.warning("AI_ENABLED=true but AI_API_KEY or AI_MODEL not set")
        return None

    if provider_name in ("openai", "openai-compatible", ""):
        return OpenAICompatibleProvider(
            api_key=api_key,
            model=model,
            base_url=base_url,
            timeout_seconds=timeout,
            max_retries=retries,
        )

    logger.warning("Unknown AI_PROVIDER: %s", provider_name)
    return None
