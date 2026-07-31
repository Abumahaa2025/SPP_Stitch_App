"""Post-generation response validator.

Validates LLM responses against 7 rules:
1. Financial values in response must exist in context
2. Tenant names must exist in context
3. Unit labels must exist in context
4. Decision IDs cited must exist in context
5. No claims of executed actions
6. No contradictions with gate (blocked gate → must use review language)
7. Response must contain non-empty answer
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from .context_builder import get_known_entities


def validate_llm_response(
    answer: str,
    context: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    """Validate an LLM response against the 7 rules.

    Args:
        answer: The LLM-generated answer text.
        context: The controlled context that was sent to the LLM.

    Returns:
        (is_valid, warnings) — is_valid is True when all rules pass.
        warnings contains human-readable rejection reasons.
    """
    warnings: List[str] = []
    answer_lower = (answer or "").lower()

    # Rule 7: Non-empty answer
    if not answer or not answer.strip():
        return False, ["Response is empty"]

    entities = get_known_entities(context)

    # Rule 1: Financial values must exist in context
    # Extract all numbers from the response that look like financial amounts.
    # Arabic-Indic digits + Western digits.
    answer_normalized = answer_lower
    # Convert Arabic-Indic digits to Western for regex.
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    for i, d in enumerate(arabic_digits):
        answer_normalized = answer_normalized.replace(d, str(i))

    # Find numbers that look like financial amounts (4+ digits, or followed by
    # currency markers). 3-digit numbers are likely unit numbers, not amounts.
    # Also check for numbers followed by ريال/ر.س/SAR.
    financial_pattern_currency = re.compile(r"(\d{1,3}(?:[,.]\d{3})+)\s*(?:ريال|ر\.?س|SAR|AED)", re.IGNORECASE)
    financial_pattern_large = re.compile(r"(\d{4,}(?:[,.]\d{3})*)")
    found_numbers = set()
    for m in financial_pattern_currency.finditer(answer_normalized):
        num_str = m.group(1).replace(",", "").replace(".", "")
        found_numbers.add(num_str)
    for m in financial_pattern_large.finditer(answer_normalized):
        num_str = m.group(1).replace(",", "").replace(".", "")
        found_numbers.add(num_str)

    known_financial = entities["financial_values"]
    invented_numbers = found_numbers - known_financial
    # Filter out numbers that are likely years (2000-2099) or percentages.
    invented_numbers = {n for n in invented_numbers if not (n.isdigit() and 2000 <= int(n) <= 2099)}
    if invented_numbers:
        warnings.append(
            f"Response contains financial values not in context: {invented_numbers}"
        )

    # Rule 2: Tenant names must exist in context
    # Extract potential tenant names (Arabic words after "المستأجر" or before "في الوحدة").
    tenant_pattern = re.compile(
        r"(?:المستأجر|tenant)\s+([A-Za-z\u0600-\u06FF\u0750-\u077F][\w\u0600-\u06FF\u0750-\u077F\s]{2,30}?)(?:\s+(?:في|from|on|الوحدة|unit|\(|,|$))"
    )
    found_tenants = set()
    for m in tenant_pattern.finditer(answer_lower):
        name = m.group(1).strip().rstrip(".,،")
        if len(name) >= 2:
            found_tenants.add(name.lower())

    known_tenants = entities["tenant_names"]
    unknown_tenants = found_tenants - known_tenants
    if unknown_tenants:
        warnings.append(
            f"Response mentions unknown tenants: {unknown_tenants}"
        )

    # Rule 3: Unit labels must exist in context
    unit_pattern = re.compile(
        r"(?:الوحدة|unit)\s+([A-Za-z0-9\-]+)"
    )
    found_units = set()
    for m in unit_pattern.finditer(answer_lower):
        unit = m.group(1).strip().lower()
        found_units.add(unit)

    known_units = entities["unit_labels"]
    unknown_units = found_units - known_units
    if unknown_units:
        warnings.append(
            f"Response mentions unknown units: {unknown_units}"
        )

    # Rule 4: Decision IDs cited must exist in context
    # Look for patterns like "قرار: xxx" or "decision: xxx".
    # Include : in the character class so IDs like "d:d_b2" are captured fully.
    id_pattern = re.compile(r"(?:قرار|decision)[:\s]+([A-Za-z0-9_\-|:.]+)")
    found_ids = set()
    for m in id_pattern.finditer(answer_lower):
        found_ids.add(m.group(1).strip().rstrip(").,،"))

    known_ids = entities["decision_ids"]
    unknown_ids = found_ids - known_ids
    if unknown_ids:
        warnings.append(
            f"Response cites unknown decision IDs: {unknown_ids}"
        )

    # Rule 5: No claims of executed actions
    execution_markers = [
        "تم التنفيذ", "تم الإرسال", "تم التحصيل", "تم الإخلاء",
        "executed", "sent", "collected", "completed action",
        "تم الصيانة", "تم التجديد",
    ]
    for marker in execution_markers:
        if marker in answer_lower:
            warnings.append(
                f"Response claims an action was executed: '{marker}'"
            )
            break

    # Rule 6: No contradictions with gate
    gate = context.get("normalized_gate") or {}
    gate_status = gate.get("status", "ok")
    if gate_status == "blocked_for_review":
        # Check for definitive claims (should use review language instead).
        definitive_markers = [
            "تم تأكيد", "مؤكد أن", "بشكل نهائي", "تأكيد المغادرة",
            "تأكيد المتأخرات", "confirmed departure", "confirmed late",
        ]
        for marker in definitive_markers:
            if marker in answer_lower:
                warnings.append(
                    f"Response makes definitive claim despite blocked gate: '{marker}'"
                )
                break

    is_valid = len(warnings) == 0
    return is_valid, warnings
