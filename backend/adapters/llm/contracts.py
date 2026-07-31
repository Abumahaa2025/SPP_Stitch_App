"""Typed request/response contracts for the LLM interpretation layer."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

TaskType = Literal["answer", "executive_summary", "decision_explanation"]
ResponseStatus = Literal["completed", "disabled", "failed", "blocked_for_review"]


class LLMRequest(BaseModel):
    """Request to the LLM interpretation layer."""

    analysis_id: str = Field(..., description="The import analysis ID to load AI state from")
    task: TaskType = Field("answer", description="What the LLM should do")
    question: Optional[str] = Field(None, description="User question (required for 'answer' task)")
    locale: str = Field("ar", description="Output language locale")


class LLMResponse(BaseModel):
    """Response from the LLM interpretation layer."""

    status: ResponseStatus = Field(..., description="Outcome status")
    analysis_id: str = Field(..., description="The analysis ID this response belongs to")
    task: str = Field(..., description="The task that was requested")
    answer: str = Field("", description="The LLM-generated answer (Arabic)")
    citations: List[str] = Field(default_factory=list, description="Source section names used")
    used_decision_ids: List[str] = Field(default_factory=list, description="Decision IDs referenced")
    gate_status: Optional[str] = Field(None, description="Consistency gate status at time of call")
    model: Optional[str] = Field(None, description="Model name used (None if disabled)")
    provider: Optional[str] = Field(None, description="Provider name used (None if disabled)")
    latency_ms: Optional[int] = Field(None, description="LLM call latency in milliseconds")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
