"""AI Property Employee — context-aware assistant layer.

Additive module (Phase 1 of the AI Property Employee mission).
Builds a structured portfolio snapshot, compresses it into a system-prompt
prefix, retrieves entity-specific memory, and generates proactive
recommendations — without touching any existing endpoint or shape.

Public API:
    build_employee_context(ctx)        -> EmployeeContext
    build_system_prompt(ctx, lang)     -> str
    retrieve_relevant_memory(ctx, q)   -> MemoryRetrieval
    generate_proactive_suggestions(ctx)-> List[Suggestion]
    classify_intent(text, lang)        -> Intent
"""

from __future__ import annotations

from .context_builder import (
    EmployeeContext,
    PortfolioSnapshot,
    PropertyRow,
    TenantRow,
    ContractRow,
    DecisionRow,
    build_employee_context,
)
from .prompt_engineer import build_system_prompt, SYSTEM_PROMPT_TEMPLATE_AR, SYSTEM_PROMPT_TEMPLATE_EN
from .memory_retriever import MemoryRetrieval, retrieve_relevant_memory
from .recommendations import Suggestion, generate_proactive_suggestions
from .intent import Intent, classify_intent

__all__ = [
    "EmployeeContext",
    "PortfolioSnapshot",
    "PropertyRow",
    "TenantRow",
    "ContractRow",
    "DecisionRow",
    "build_employee_context",
    "build_system_prompt",
    "SYSTEM_PROMPT_TEMPLATE_AR",
    "SYSTEM_PROMPT_TEMPLATE_EN",
    "MemoryRetrieval",
    "retrieve_relevant_memory",
    "Suggestion",
    "generate_proactive_suggestions",
    "Intent",
    "classify_intent",
]

__version__ = "ai-employee-v1"
