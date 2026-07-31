"""LLM Interpretation Layer — Gap 6.

A controlled interpretation layer that uses ONE external LLM provider
to explain verified SPP intelligence results in Arabic executive language.

The LLM NEVER:
- calculates financial totals
- invents tenants, units, contracts, or payments
- creates lifecycle events
- overrides the consistency gate
- changes decision scores
- executes decisions
- accesses raw uploaded files

The LLM ONLY:
- explains verified results
- summarizes intelligence
- answers questions from persisted AI state
- produces clear Arabic executive language
- presents approved recommendations

Public API:
    LLMRequest, LLMResponse    — typed contracts
    LLMService                  — orchestrator (load → context → gate → call → validate)
    FakeProvider                — test provider with configurable behavior
    build_controlled_context()  — strict context builder from AI state
    validate_llm_response()     — post-generation validation
"""

from __future__ import annotations

from .contracts import LLMRequest, LLMResponse
from .context_builder import build_controlled_context
from .prompts import build_system_prompt, build_user_prompt
from .provider import FakeProvider, LLMProvider, OpenAICompatibleProvider, get_provider
from .service import LLMService
from .validator import validate_llm_response

__all__ = [
    "FakeProvider",
    "LLMProvider",
    "LLMRequest",
    "LLMResponse",
    "LLMService",
    "OpenAICompatibleProvider",
    "build_controlled_context",
    "build_system_prompt",
    "build_user_prompt",
    "get_provider",
    "validate_llm_response",
]

__version__ = "llm-interpretation-v1"
