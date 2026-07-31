"""AI Property Employee — Intent Classifier.

Light, deterministic intent classification for chat messages.
Identifies the entity the user is asking about (property, tenant, unit,
contract) so the memory retriever can pull the right slice.

This is intentionally rule-based — no LLM call, no extra latency, no
extra API cost. Falls back to "general" when no entity is detected.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Literal

IntentKind = Literal[
    "property_query",
    "tenant_query",
    "contract_query",
    "financial_query",
    "maintenance_query",
    "decision_query",
    "general",
]


@dataclass
class Intent:
    kind: IntentKind = "general"
    property_id: str = ""
    tenant_id: str = ""
    unit: str = ""
    contract_id: str = ""
    keywords: List[str] = field(default_factory=list)
    language_hint: str = ""  # "ar" / "en" / ""

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "property_id": self.property_id,
            "tenant_id": self.tenant_id,
            "unit": self.unit,
            "contract_id": self.contract_id,
            "keywords": self.keywords,
            "language_hint": self.language_hint,
        }


# Arabic + English keyword sets. Lowercased comparison.
_AR_KEYWORDS = {
    "property_query": ["عقار", "عقارات", "فيلا", "شقة", "بنتهاوس", "مكتب", "مبنى", "عقارها", "العقار"],
    "tenant_query": ["مستأجر", "مستأجرين", "الساكن", "السكان", "المستأجر", "موثوقية", "موثوق"],
    "contract_query": ["عقد", "عقود", "تجديد", "العقد", "انتهاء", "مدة"],
    "financial_query": ["إيجار", "تحصيل", "متأخرات", "دفع", "إيراد", "مالي", "الريال", "ريال", "المتأخر"],
    "maintenance_query": ["صيانة", "إصلاح", "عطل", "تصليح", "مشكلة", "عطل", "خلل"],
    "decision_query": ["قرار", "قرارات", "توصية", "ماذا أفعل", "أولوية", "الأولوية"],
}
_EN_KEYWORDS = {
    "property_query": ["property", "properties", "villa", "apartment", "penthouse", "office", "building"],
    "tenant_query": ["tenant", "tenants", "resident", "residents", "occupant", "reliable", "reliability"],
    "contract_query": ["contract", "contracts", "renewal", "expiry", "expiring", "lease"],
    "financial_query": ["rent", "payment", "arrears", "revenue", "income", "financial", "sar", "aed"],
    "maintenance_query": ["maintenance", "repair", "fix", "issue", "fault", "broken"],
    "decision_query": ["decision", "decisions", "recommend", "recommendation", "priority", "what should i do"],
}


def _detect_language(text: str) -> str:
    """Return 'ar' if the text contains Arabic letters, else 'en'."""
    if re.search(r"[\u0600-\u06FF\u0750-\u077F]", text or ""):
        return "ar"
    return "en"


def _find_property_match(text: str, properties: List[dict]) -> str:
    """Return the property id whose name appears in the text (case-insensitive).

    Uses a sliding 2-word window so that "Marina Crest" matches a property
    named "Marina Crest Residences" (the user often shortens names).
    """
    t = (text or "").lower()
    for p in properties:
        name = str(p.get("name") or "").strip().lower()
        if not name:
            continue
        # Direct full-name match.
        if name in t:
            return str(p.get("id") or "")
        # Sliding 2-word window (handles short-form mentions of longer names).
        words = name.split()
        if len(words) >= 2:
            for i in range(len(words) - 1):
                window = " ".join(words[i:i + 2])
                if len(window) >= 6 and window in t:  # avoid tiny windows like "a b"
                    return str(p.get("id") or "")
        # Direct id match.
        pid = str(p.get("id") or "")
        if pid and pid.lower() in t:
            return pid
    return ""


def _find_tenant_match(text: str, tenants: List[dict]) -> str:
    t = (text or "").lower()
    for tn in tenants:
        name = str(tn.get("name") or "").strip().lower()
        if not name:
            continue
        # Full-name match.
        if name in t:
            return str(tn.get("id") or "")
        # Last-name match (at least 4 chars to avoid false positives).
        words = name.split()
        if len(words) >= 2:
            last = words[-1]
            if len(last) >= 4 and (" " + last in t or t.startswith(last + " ") or t.endswith(" " + last)):
                return str(tn.get("id") or "")
        # First-name match (at least 4 chars).
        first = words[0] if words else ""
        if len(first) >= 4 and (" " + first in t or t.startswith(first + " ") or t.endswith(" " + first)):
            return str(tn.get("id") or "")
    return ""


def _find_unit_match(text: str) -> str:
    """Match patterns like 'unit 12', 'وحدة 12', 'A-101', etc."""
    patterns = [
        r"unit\s+([A-Za-z0-9\-]+)",
        r"وحدة\s+([A-Za-z0-9\-]+)",
        r"\b([A-Z]-?\d{2,4})\b",  # A-101, B203
    ]
    for pat in patterns:
        m = re.search(pat, text or "")
        if m:
            return m.group(1)
    return ""


def _find_contract_match(text: str, contracts: List[dict]) -> str:
    t = (text or "").lower()
    # Direct contract id (e.g. "contract_2")
    m = re.search(r"contract[_\s-]*([A-Za-z0-9]+)", t)
    if m:
        needle = f"contract_{m.group(1)}".lower()
        for c in contracts:
            cid = str(c.get("id") or "").lower()
            if cid == needle:
                return str(c.get("id") or "")
    return ""


def classify_intent(
    text: str,
    properties: List[dict] | None = None,
    tenants: List[dict] | None = None,
    contracts: List[dict] | None = None,
) -> Intent:
    """Classify user intent + extract entity references.

    Args:
        text: user chat message.
        properties/tenants/contracts: live domain lists (for entity matching).

    Returns:
        Intent with kind + ids of any matched entities.
    """
    properties = properties or []
    tenants = tenants or []
    contracts = contracts or []

    text_lower = (text or "").lower()
    lang = _detect_language(text)

    # Pick keyword set by detected language; check both for bilingual queries.
    keyword_set = _AR_KEYWORDS if lang == "ar" else _EN_KEYWORDS
    detected_keywords: List[str] = []
    for kind, words in keyword_set.items():
        for w in words:
            if w in text_lower:
                detected_keywords.append(w)

    # Determine kind by majority of matched keywords, with priority order:
    # decision > maintenance > financial > contract > tenant > property > general.
    priority_order = [
        "decision_query",
        "maintenance_query",
        "financial_query",
        "contract_query",
        "tenant_query",
        "property_query",
    ]
    kind: IntentKind = "general"
    for candidate in priority_order:
        if any(w in text_lower for w in keyword_set.get(candidate, [])):
            kind = candidate  # type: ignore[assignment]
            break
    # Fallback: also check the other language's keywords (bilingual messages).
    if kind == "general":
        other_set = _EN_KEYWORDS if lang == "ar" else _AR_KEYWORDS
        for candidate in priority_order:
            if any(w in text_lower for w in other_set.get(candidate, [])):
                kind = candidate  # type: ignore[assignment]
                break

    # Entity extraction (always attempt — user may mix entity + intent words).
    prop_id = _find_property_match(text, properties)
    tenant_id = _find_tenant_match(text, tenants)
    unit = _find_unit_match(text)
    contract_id = _find_contract_match(text, contracts)

    # Refine kind based on matched entities.
    #
    # If a specific entity (property/tenant/contract) was matched, the user
    # is asking about THAT entity — so prefer the entity-kind over generic
    # kinds like `general` or `decision_query`. But keep more specific
    # intent kinds (maintenance_query, financial_query) when they were
    # explicitly detected — those scopes are still useful even with a
    # matched entity.
    #
    # Examples:
    #   "What should I do about Marina Crest?"     → property + decision → property_query
    #   "HVAC repair at Marina Crest"               → property + maintenance → maintenance_query
    #   "Collect rent from Priya Kapoor"            → tenant + financial → financial_query
    if prop_id and kind in ("general", "decision_query"):
        kind = "property_query"
    elif tenant_id and kind in ("general", "decision_query"):
        kind = "tenant_query"
    elif contract_id and kind in ("general", "decision_query"):
        kind = "contract_query"
    elif unit and kind in ("general", "decision_query"):
        kind = "tenant_query"  # asking about a unit = asking about its tenant

    return Intent(
        kind=kind,
        property_id=prop_id,
        tenant_id=tenant_id,
        unit=unit,
        contract_id=contract_id,
        keywords=detected_keywords,
        language_hint=lang,
    )
